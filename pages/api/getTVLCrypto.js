import axios from 'axios';
import Web3 from 'web3';
import BigNumber from 'big-number';

import { fn } from '../../utils/api';
import { getRegistry, getMultiCall } from '../../utils/getters';
import registryAbi from '../../constants/abis/registry.json';
import multicallAbi from '../../constants/abis/multicall.json';
import erc20Abi from '../../constants/abis/erc20.json';
import cryptoPoolAbi from '../../constants/abis/crypto_pool.json';

const web3 = new Web3(`https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`);


export default fn(async () => {

    let cryptoPools = {
      'tricrypto': {
        'address': '0x80466c64868E1ab14a1Ddf27A676C3fcBE638Fe5',
        'token': '0xcA3d75aC011BF5aD07a98d02f18225F9bD9A6BDF',
        'coins': 3,
        'keys': ['tether', 'bitcoin', 'ethereum'],
        'decimals': [6, 8, 18],
        'tvl': 0,
        'lpPrice': 0
      },
      'tricrypto2': {
        'address': '0xD51a44d3FaE010294C616388b506AcdA1bfAAE46',
        'token': '0xc4AD29ba4B3c580e6D59105FFf484999997675Ff',
        'coins': 3,
        'keys': ['tether', 'bitcoin', 'ethereum'],
        'decimals': [6, 8, 18],
        'tvl': 0,
        'lpPrice': 0
      },
      'eurtusd': {
        'address': '0x9838eCcC42659FA8AA7daF2aD134b53984c9427b',
        'token': '0x3b6831c0077a1e44ED0a21841C3bC4dC11bCE833',
        'coins': 2,
        'keys': ['tether-eurt', 'tether'],
        'decimals': [6, 18],
        'tvl': 0,
        'lpPrice': 0
      },
      'eursusd': {
        'address': '0x98a7F18d4E56Cfe84E3D081B40001B3d5bD3eB8B',
        'token': '0x3D229E1B4faab62F621eF2F6A610961f7BD7b23B',
        'coins': 2,
        'keys': ['tether', 'stasis-eurs'],
        'decimals': [6, 2],
        'tvl': 0,
        'lpPrice': 0
      }
    }

    let price_feed = await (await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether,ethereum,bitcoin,tether-eurt,stasis-eurs&vs_currencies=usd')).json()

    for (const [key, pool] of Object.entries(cryptoPools)) {
      let poolContract = new web3.eth.Contract(cryptoPoolAbi, pool.address);
      for (var i = 0; i < pool.coins; i++) {

         let balance = await poolContract.methods.balances(i).call();
         cryptoPools[key].tvl += balance / 10 ** pool.decimals[i] * price_feed[pool.keys[i]].usd
      }

      let tokenContract = new web3.eth.Contract(erc20Abi, pool.token);

      let supply = await tokenContract.methods.totalSupply().call();
      cryptoPools[key].lpPrice = cryptoPools[key].tvl / (supply / 10 ** 18)

    }

    return { cryptoPools };

}, {
  maxAge: 15 * 60, // 15 min
});
