#!/bin/bash

source ./scripts/utils/generate_truffle_config.sh

echo No third party contracts to compile! Skipping...
exit 0

# # build mock contract
# generate_truffle_config "0.6.0" "..\/node_modules\/@gnosis.pm\/mock-contract\/contracts"
# truffle compile
