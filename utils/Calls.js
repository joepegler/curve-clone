/* eslint-disable camelcase */

import Web3 from 'web3';
import memoize from 'memoizee';
import multicall_abi from '../constants/abis/multicall.json';
import { getArrayChunks, flattenArray } from './Array';

const web3 = new Web3(`https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`);

// Contract instances cache store
const getContractInstance = memoize((address, abi, library) => (
  new library.eth.Contract(abi, address)
));

/**
 * @param {Array<{contract: Object, methodName: String, params: Array}>} callsConfig
 *
 * Returns an array of data.
 * If `metaData` is passed alongside any call, returns an array of objects of shape { data, metaData } instead.
 */
const multiCall = async (callsConfig) => {
  const defaultCallConfig = {
    // Pass either a contract object (if that contract object is already instantiated and it's easier)
    contract: undefined, // e.g. currentContract
    // Or pass both address and abi for the utility to instantiate and cache the contract instance
    address: undefined,
    abi: undefined,
    methodName: undefined, // e.g. 'claimable_tokens'
    params: [], // Array of params, if the method takes any
    // Optional; any data to be passed alongside each call's results, for example to act as a marker
    // to easily identify what the call's results reference
    metaData: undefined,
    networkSettings: {
      web3,
      multicallAddress: '0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441',
    },
  };

  const augmentedCallsConfig = callsConfig.map((config) => ({
    ...defaultCallConfig,
    ...config,
  }));

  // Validate configs
  // eslint-disable-next-line no-restricted-syntax
  for (const config of augmentedCallsConfig) {
    const usesContractField = typeof config.contract !== 'undefined';

    if (usesContractField && typeof config.contract !== 'object') {
      throw new Error('multiCall error: config parameter `contract` expects a contract object');
    }

    if (!usesContractField && typeof config.address !== 'string') {
      throw new Error('multiCall error: config parameter `address` expects a contract address');
    }

    if (!usesContractField && !Array.isArray(config.abi)) {
      throw new Error('multiCall error: config parameter `abi` expects an array');
    }

    if (typeof config.methodName !== 'string') {
      throw new Error('multiCall error: config parameter `methodName` expects a contract method name');
    }

    if (usesContractField && !config.contract._address) {
      throw new Error('multiCall error: couldn’t find any `_address` property on config parameter `contract`; either the contract object passed in incorrect, or we need to make multiCall accept an optional address param to pass it manually ourselves when it’s not implicitly set on `contract`');
    }
  }

  const hasMetaData = augmentedCallsConfig.some(({ metaData }) => typeof metaData !== 'undefined');
  const calls = augmentedCallsConfig.map(({
    contract,
    address,
    abi,
    methodName,
    params,
    networkSettings,
  }) => [
    contract?._address || address,
    (contract || getContractInstance(address, abi, networkSettings.web3)).methods[methodName](...params).encodeABI(),
  ]);

  const { networkSettings } = augmentedCallsConfig[0];
  const multicall = getContractInstance(networkSettings.multicallAddress, multicall_abi, networkSettings.web3);
  const chunkedReturnData = [];
  const chunkedCalls = getArrayChunks(calls, 200); // Keep each multicall size reasonable

  // eslint-disable-next-line no-restricted-syntax
  for (const callsChunk of chunkedCalls) {
    // eslint-disable-next-line no-await-in-loop
    const { returnData } = await multicall.methods.aggregate(callsChunk).call();
    chunkedReturnData.push(returnData);
  }

  const returnData = flattenArray(chunkedReturnData);

  const decodedData = returnData.map((hexData, i) => {
    const { contract, abi, methodName, metaData } = augmentedCallsConfig[i];
    const contractAbi = contract?._jsonInterface || abi;
    const outputSignature = contractAbi.find(({ name }) => name === methodName).outputs;

    const data = outputSignature.length > 1 ?
      networkSettings.web3.eth.abi.decodeParameters(outputSignature.map(({ type, name }) => ({ type, name })), hexData) :
      networkSettings.web3.eth.abi.decodeParameter(outputSignature[0].type, hexData);

    if (hasMetaData) return { data, metaData };
    return data;
  });

  return decodedData;
};

export {
  multiCall,
};
