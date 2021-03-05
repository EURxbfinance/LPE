#!/bin/bash

source ./scripts/utils/generate_truffle_config.sh

 # build mock contract
 generate_truffle_config "0.6.6" ".\/node_modules\/@gnosis.pm\/mock-contract\/contracts"
 truffle compile

 # copy uniswap artifacts
 cp ./node_modules/@uniswap/v2-core/build/UniswapV2Factory.json ./build/contracts
