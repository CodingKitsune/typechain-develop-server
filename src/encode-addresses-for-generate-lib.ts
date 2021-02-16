export function encodeAddressesForGenerateLib(contracts: Record<string, string>): string {
  return Object.entries(contracts)
    .map(r => `${r[0]}=${r[1]}`)
    .join(',');
}
