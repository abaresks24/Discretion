import { config as dotenvConfig } from "dotenv";
import path from "node:path";
// Load deployer + contract addresses from the contracts .env
dotenvConfig({ path: path.resolve(process.cwd(), "../contracts/.env") });
// Layer over backend .env if present
dotenvConfig({ override: false });
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  parseAbi,
  formatEther,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";

const RPC = process.env.ARBITRUM_SEPOLIA_RPC ?? "https://arbitrum-sepolia-rpc.publicnode.com";
const DEPLOYER_PK = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
const WRAP_QUEUE = process.env.WRAP_QUEUE_ADDRESS as `0x${string}`;
const UNWRAP_QUEUE = process.env.UNWRAP_QUEUE_ADDRESS as `0x${string}`;
const FUND_AMOUNT_ETH = "0.01"; // operator gas budget

if (!DEPLOYER_PK || !WRAP_QUEUE) {
  console.error("Missing DEPLOYER_PRIVATE_KEY or WRAP_QUEUE_ADDRESS in env");
  process.exit(1);
}

const queueAbi = parseAbi([
  "function owner() view returns (address)",
  "function operator() view returns (address)",
  "function setOperator(address newOperator) external",
]);

const main = async () => {
  const deployer = privateKeyToAccount(DEPLOYER_PK);
  const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(RPC) });
  const walletClient = createWalletClient({
    account: deployer,
    chain: arbitrumSepolia,
    transport: http(RPC),
  });

  console.log(`deployer: ${deployer.address}`);

  // 1. New operator keypair
  const operatorPk = generatePrivateKey();
  const operator = privateKeyToAccount(operatorPk);
  console.log(`new operator: ${operator.address}`);

  // 2. Update WrapQueue operator
  const queues = [
    { name: "WrapQueue", address: WRAP_QUEUE },
    ...(UNWRAP_QUEUE ? [{ name: "UnwrapQueue", address: UNWRAP_QUEUE }] : []),
  ];

  for (const q of queues) {
    const owner = await publicClient.readContract({
      address: q.address,
      abi: queueAbi,
      functionName: "owner",
    });
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.warn(`SKIP ${q.name}: deployer is not owner (${owner})`);
      continue;
    }
    const txHash = await walletClient.writeContract({
      address: q.address,
      abi: queueAbi,
      functionName: "setOperator",
      args: [operator.address],
    });
    console.log(`${q.name}.setOperator → ${txHash}`);
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`${q.name} operator updated ✓`);
  }

  // 3. Fund operator
  const fundTx = await walletClient.sendTransaction({
    to: operator.address,
    value: parseEther(FUND_AMOUNT_ETH),
  });
  console.log(`fund ${FUND_AMOUNT_ETH} ETH → ${operator.address} (${fundTx})`);
  await publicClient.waitForTransactionReceipt({ hash: fundTx });
  const bal = await publicClient.getBalance({ address: operator.address });
  console.log(`operator balance: ${formatEther(bal)} ETH ✓`);

  console.log("\n=== ADD TO backend/.env ===");
  console.log(`MIXER_OPERATOR_PRIVATE_KEY=${operatorPk}`);
  console.log(`MIXER_OPERATOR_ADDRESS=${operator.address}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
