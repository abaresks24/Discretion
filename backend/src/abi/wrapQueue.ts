import { parseAbi } from "viem";

export const wrapQueueAbi = parseAbi([
  "function pendingIds(uint256 cursor, uint256 limit) view returns (uint256[])",
  "function queueLength() view returns (uint256)",
  "function operator() view returns (address)",
  "function processBatch(uint256[] calldata ids) external",
  "event Queued(uint256 indexed id, address indexed depositor, uint256 amount)",
  "event BatchProcessed(uint256 count)",
]);
