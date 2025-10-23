/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/my_project.json`.
 */
export type MyProject = {
  "address": "ENppTkN4QxFG6fepC7cbWZcM6zsEAw7KXSQ9Qy6yC1vq",
  "metadata": {
    "name": "myProject",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "buyWithQuote",
      "discriminator": [
        167,
        36,
        127,
        201,
        10,
        87,
        43,
        98
      ],
      "accounts": [
        {
          "name": "state",
          "writable": true
        },
        {
          "name": "buyer",
          "signer": true
        },
        {
          "name": "buyerQuote",
          "writable": true
        },
        {
          "name": "recipientQuote",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "buyerToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "quoteMint"
        }
      ],
      "args": [
        {
          "name": "maxQuoteAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "depositTokens",
      "discriminator": [
        176,
        83,
        229,
        18,
        191,
        143,
        176,
        150
      ],
      "accounts": [
        {
          "name": "state",
          "writable": true
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "state"
          ]
        },
        {
          "name": "from",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "extendOnce",
      "discriminator": [
        205,
        172,
        127,
        191,
        107,
        212,
        145,
        109
      ],
      "accounts": [
        {
          "name": "state",
          "writable": true
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "state"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "fundsRecipient"
        },
        {
          "name": "state",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "totalForSale",
          "type": "u64"
        },
        {
          "name": "basePriceQuotePerToken",
          "type": "u64"
        },
        {
          "name": "priceIncrementPerPhaseQuote",
          "type": "u64"
        },
        {
          "name": "perPhaseAllocation",
          "type": "u64"
        },
        {
          "name": "ethEnabled",
          "type": "bool"
        }
      ]
    },
    {
      "name": "withdrawUnsold",
      "discriminator": [
        6,
        159,
        31,
        233,
        165,
        117,
        226,
        159
      ],
      "accounts": [
        {
          "name": "state",
          "writable": true
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "state"
          ]
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "to",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "state",
      "discriminator": [
        216,
        146,
        107,
        94,
        104,
        75,
        182,
        177
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "saleNotActive",
      "msg": "Sale not active"
    },
    {
      "code": 6001,
      "name": "zeroAddress",
      "msg": "Zero address"
    },
    {
      "code": 6002,
      "name": "invalidConfig",
      "msg": "Invalid config"
    },
    {
      "code": 6003,
      "name": "nothingToWithdraw",
      "msg": "Nothing to withdraw"
    },
    {
      "code": 6004,
      "name": "alreadyExtended",
      "msg": "Already extended"
    },
    {
      "code": 6005,
      "name": "insufficientFunds",
      "msg": "Insufficient funds"
    }
  ],
  "types": [
    {
      "name": "phase",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "priceQuotePerToken",
            "type": "u64"
          },
          {
            "name": "allocation",
            "type": "u64"
          },
          {
            "name": "sold",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "state",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "fundsRecipient",
            "type": "pubkey"
          },
          {
            "name": "saleStart",
            "type": "u64"
          },
          {
            "name": "saleEndInitial",
            "type": "u64"
          },
          {
            "name": "saleEnd",
            "type": "u64"
          },
          {
            "name": "extended",
            "type": "bool"
          },
          {
            "name": "totalForSale",
            "type": "u64"
          },
          {
            "name": "phases",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "phase"
                  }
                },
                10
              ]
            }
          },
          {
            "name": "ethEnabled",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
