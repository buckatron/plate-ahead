import { BlockList, isIP } from "node:net";

const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["2001:db8::", 32], ["ff00::", 8]] as const) {
  blocked.addSubnet(address, prefix, "ipv6");
}

export function publicImportAddress(address: string): boolean {
  const family = isIP(address);
  if (!family || blocked.check(address, family === 6 ? "ipv6" : "ipv4")) return false;
  // Avoid IPv4-mapped IPv6 aliases; ordinary DNS A records arrive as family 4.
  return family !== 6 || !address.toLowerCase().startsWith("::ffff:");
}
