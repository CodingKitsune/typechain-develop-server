/* eslint-disable no-console */
import Nodemon from 'nodemon';
import { resolve } from 'path';
import GanacheCLI from 'ganache-cli';
import { spawn, ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { green, blue, red, yellow } from 'chalk';
import { notify } from 'node-notifier';
import { parseArgsStringToArgv } from 'string-argv';
import { getContractAddressesFromMigrate } from './get-contract-addresses-from-migrate';
import { encodeAddressesForGenerateLib } from './encode-addresses-for-generate-lib';

let server;
const cwd = process.cwd();

const truffleConfingFile = resolve(
  cwd,
  process.env.npm_package_typechain_develop_server_truffle_config || './truffle-config.js',
);
if (!existsSync(truffleConfingFile)) {
  throw new Error(
    `Truffle config file could not be found at: ${truffleConfingFile}\nYou can change the expected file location with the package.json property "typechain-develop-server"."truffle-config"`,
  );
}
const truffleConfig = require(truffleConfingFile);

const migrateNetworkName = process.env.npm_package_typechain_develop_server_truffle_migrate_network || 'development';
if (!truffleConfig?.networks[migrateNetworkName]) {
  throw new Error(
    `No truffle network configuration exists with the name "${migrateNetworkName}", please add one, alongside with a default port.`,
  );
}

const port = truffleConfig?.networks[migrateNetworkName].port;
if (!port) {
  throw new Error(`No port is set for network "${migrateNetworkName}", please add one.`);
}
const serverPort = parseInt(port, 10);

const compileScript = process.env.npm_package_typechain_develop_server_compile_script;
if (!compileScript) {
  throw new Error(
    `No compile script has been set, please add one using the package.json property "typechain-develop-server"."compile-script"\nSo the server can properly compile your contracts.`,
  );
}

const migrateScript = process.env.npm_package_typechain_develop_server_migrate_script;
if (!migrateScript) {
  throw new Error(
    `No migrate script has been set, please add one using the package.json property "typechain-develop-server"."migrate-script"\nSo the server can properly run migrations on a blockchain.`,
  );
}

const generateTypesScript = process.env.npm_package_typechain_develop_server_generate_types_script;
if (!generateTypesScript) {
  throw new Error(
    `No generate types script has been set, please add one using the package.json property typechain-develop-server"."generate-types-script"\nSo the server can properly generate your type definitions and lib.`,
  );
}

const generateLibScript = process.env.npm_package_typechain_develop_server_generate_lib_script;
if (!generateLibScript) {
  throw new Error(
    `No generate lib script has been set, please add one using the package.json property "typechain-develop-server"."generate-lib-script"\nSo the server can properly generate your lib for UI use.`,
  );
}

const processList: ChildProcess[] = [];

function runShellCommand(command: string): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    let output = '';
    const commandPieces = parseArgsStringToArgv(command);
    const commandProcess = spawn(commandPieces.shift(), commandPieces, {
      cwd,
    });
    processList.push(commandProcess);
    commandProcess.on('error', () => {
      console.error(output);
      console.log('\n\n\n');
      rejectPromise();
    });
    commandProcess.stdout.on('data', data => {
      const msg = data.toString();
      output += msg;
    });
    commandProcess.on('close', code => {
      if (code !== 0) {
        console.error(output);
        console.log('\n\n\n');
        return rejectPromise();
      }

      resolvePromise(output);
    });
  });
}

async function rebuildAndDeployContracts() {
  console.log(blue('Compiling all contracts...'));
  const output = await runShellCommand(compileScript);
  if (output.includes('Compilation warnings')) {
    console.log(yellow(output));
    console.log('\n\n\n');
  }
  console.log(green('All Contracts were compiled with success'));
  console.log();

  console.log(blue('Generating contract types...'));
  await runShellCommand(generateTypesScript);
  console.log(green('Types generated successfully'));
  console.log();

  console.log(blue('Attempting to deploy contracts to a new blockchain...'));
  const migrateOutput = await runShellCommand(migrateScript);
  console.log(green('Deployed all contracts to a new blockchain'));
  console.log();

  const configJson = getContractAddressesFromMigrate(migrateOutput);
  for (const [name, address] of Object.entries(configJson.contracts)) {
    console.log(green(name), blue(address));
  }
  console.log();

  const libEncodedAddresses = encodeAddressesForGenerateLib(configJson.contracts);
  console.log(blue('Regenerating lib files (for UI and derived services)...'));
  await runShellCommand(generateLibScript.replace('<ADDRESSES>', libEncodedAddresses));
  console.log(green('Regenerated lib files (for UI and derived services) succesfully!'));
  console.log();
}

console.log(blue('Starting watch proccess...'));

Nodemon({
  ext: 'sol',
});

Nodemon.on('start', async () => {
  if (server) {
    await new Promise(resolve => {
      server.close(resolve);
    });
  }

  // eslint-disable-next-line require-atomic-updates
  server = GanacheCLI.server();
  server.listen(serverPort);

  for (const commandProcess of processList) {
    commandProcess.kill();
  }

  try {
    await rebuildAndDeployContracts();
    const msg = 'All contracts have been deployed!';
    console.log(green('-'.repeat(20)));
    console.log();
    console.log(green(msg));
    console.log(green('Blockchain address:'));
    console.log(green(`http://localhost:${serverPort}`));
    notify({
      title: 'Success!',
      message: msg,
    });
  } catch (e) {
    console.error(e);
    console.error(red('-'.repeat(20)));
    console.log();
    const msg = 'Failed to compile and redeploy contracts!';
    console.error(red(msg));
    notify({
      title: 'Failed to compile and redeploy contracts!',
      message: msg,
      type: 'error',
    });
  }
});
