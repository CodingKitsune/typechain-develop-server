export function getContractAddressesFromMigrate(
  output: string,
): { currentVersion: number; contracts: Record<string, string> } {
  const splitOnDeploying = output.split('Deploying');
  const splitOnReplacing = output.split('Replacing');
  const pieces = splitOnDeploying.length > splitOnReplacing.length ? splitOnDeploying : splitOnReplacing;
  const result = pieces
    .filter((_r, index) => index !== 0)
    .map(p => p.split('\n'))
    .map(r => {
      const extractName = /'(.+)'/;
      const extractAddress = /(0x.+)$/;
      return {
        name: extractName.exec(r[0])[1],
        address: extractAddress.exec(r[4])[1],
      };
    })
    .reduce(
      (acc, { name, address }) => {
        acc.contracts[name] = address;
        return acc;
      },
      { currentVersion: Date.now(), contracts: {} },
    );

  return result;
}
