import { useDropzone } from 'react-dropzone';
import Button from '../../../../components/elements/Button';
import {
  ContractName,
  MaxAccountIdLen,
  MaxU128,
  MinAccountIdLen,
  NO_DEPOSIT,
  THIRTY_TGAS,
  ValidAccountRe,
  ValidTokenIdRe,
  BoatOfGas,
  OneNear
} from '../../../../lib/constant';
import { useNearWalletContext } from '../../../../lib/useNearWallet';
import { useEffect, useState } from 'react';
import { imageFileToBase64 } from '../../../../lib/imageFileToBase64';

type FungibleTokenMetadata = {
  spec: 'ft-1.0.0';
  name: string;
  symbol: string;
  icon: string;
  decimals: number;
};

export type TokenArgs = {
  owner_id: string;
  total_supply: string;
  metadata: FungibleTokenMetadata;
};

const fromYocto = (a: bigint) => (a ? (Number(a) / Number(OneNear)).toFixed(6) : '0');

const OptionsSection = () => {
  const wallet = useNearWalletContext();

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: async (acceptedFiles) => {
      const base64 = await imageFileToBase64(acceptedFiles[0]);
      setTokenArgs((prevArgs) => ({
        ...prevArgs,
        metadata: {
          ...prevArgs.metadata,
          icon: base64
        }
      }));
    },
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.svg']
    }
  });

  const [tokenArgs, setTokenArgs] = useState<
    TokenArgs & {
      tokenSymbolStatus: 'loading' | 'valid' | 'invalid' | 'idle';
      ownerStatus: 'loading' | 'valid' | 'invalid' | 'idle';
    }
  >({
    owner_id: wallet.accountId || '',
    total_supply: '1000000000',
    metadata: {
      spec: 'ft-1.0.0',
      name: '',
      symbol: '',
      icon: '',
      decimals: 18
    },
    tokenSymbolStatus: 'idle',
    ownerStatus: 'idle'
  });

  const [expandTokenCreation, setExpandTokenCreation] = useState(false);
  const [requiredDeposit, setRequiredDeposit] = useState<bigint>(BigInt(0));

  async function validateOwnerAccount(accountId: string) {
    if (accountId) {
      const exist = await wallet.doesAccountExist(accountId);
      setTokenArgs((prevArgs) => ({
        ...prevArgs,
        ownerStatus: exist ? 'valid' : 'invalid'
      }));
    }
  }

  async function doesTokenExist(tokenId: string) {
    let exist = false;
    try {
      const description = await wallet.viewMethod({
        contractId: ContractName,
        method: 'get_token',
        args: {
          token_id: tokenId
        }
      });
      exist = description !== null;
    } catch {}

    setTokenArgs((prevArgs) => ({
      ...prevArgs,
      tokenSymbolStatus: exist ? 'invalid' : 'valid'
    }));
  }

  const isValidAccountId = (accountId: string) => {
    return (
      accountId.length >= MinAccountIdLen &&
      accountId.length <= MaxAccountIdLen &&
      accountId.match(ValidAccountRe)
    );
  };

  const isValidTokenId = (tokenId: string) => {
    tokenId = tokenId.toLowerCase();
    return tokenId.match(ValidTokenIdRe) && isValidAccountId(tokenId + '.' + ContractName);
  };

  const tokenIdClass = () => {
    if (
      !tokenArgs.metadata.symbol ||
      (isValidTokenId(tokenArgs.metadata.symbol) && tokenArgs.tokenSymbolStatus === 'loading')
    ) {
      return 'form-control form-control-large';
    } else if (
      isValidTokenId(tokenArgs.metadata.symbol) &&
      tokenArgs.tokenSymbolStatus === 'valid'
    ) {
      return 'form-control form-control-large is-valid';
    } else {
      return 'form-control form-control-large is-invalid';
    }
  };

  const ownerIdClass = () => {
    if (
      !tokenArgs.owner_id ||
      (isValidAccountId(tokenArgs.owner_id) && tokenArgs.ownerStatus === 'loading')
    ) {
      return 'form-control form-control-large';
    } else if (isValidAccountId(tokenArgs.owner_id) && tokenArgs.ownerStatus === 'valid') {
      return 'form-control form-control-large is-valid';
    } else {
      return 'form-control form-control-large is-invalid';
    }
  };

  useEffect(() => {
    (async () => {
      if (!wallet.accountId) return;

      const args = {
        owner_id: 'pysr.near',
        total_supply: '1000000000',
        metadata: {
          spec: 'ft-1.0.0',
          name: 'hello',
          symbol: 'wassup',
          icon: 'somedatasvg',
          decimals: 18
        }
      };

      const required_deposit = await wallet.viewMethod({
        contractId: 'tkn.near',
        method: 'get_required_deposit',
        args: {
          account_id: wallet.accountId,
          args
        }
      });

      setRequiredDeposit(BigInt(required_deposit));
    })();
  }, [tokenArgs, expandTokenCreation]);

  async function createToken() {
    if (!wallet.wallet) return;

    const args = {
      owner_id: tokenArgs.owner_id,
      total_supply: tokenArgs.total_supply,
      metadata: tokenArgs.metadata
    };

    const actions: Parameters<
      typeof wallet.wallet.signAndSendTransactions
    >[0]['transactions'][number]['actions'] = [];

    if (requiredDeposit > BigInt(0)) {
      actions.push({
        type: 'FunctionCall',
        params: {
          methodName: 'storage_deposit',
          args: {},
          gas: BoatOfGas.toString(),
          deposit: requiredDeposit.toString()
        }
      });
    }

    actions.push({
      type: 'FunctionCall',
      params: {
        methodName: 'create_token',
        args,
        gas: THIRTY_TGAS,
        deposit: NO_DEPOSIT
      }
    });

    await wallet.wallet?.signAndSendTransactions({
      transactions: [
        {
          receiverId: ContractName,
          actions
        }
      ]
    });
  }

  return (
    <div>
      <h4>
        Hello, <span className="font-weight-bold">{wallet.accountId}</span>!
      </h4>
      {!expandTokenCreation ? (
        <Button
          text={'Expand token creation form'}
          onClick={() => {
            setExpandTokenCreation(true);
            if (typeof wallet.accountId === 'string' && isValidAccountId(wallet.accountId)) {
              setTokenArgs((prevArgs) => ({
                ...prevArgs,
                owner_id: wallet.accountId!,
                ownerStatus: 'valid'
              }));
            }
          }}
        />
      ) : (
        <div>
          <p>
            Issue a new token. It'll cost you
            <span className="font-weight-bold"> {fromYocto(requiredDeposit)} Ⓝ</span>
          </p>
          <div className="form-group">
            <label htmlFor="tokenName">Token Name</label>
            <div className="input-group">
              <input
                type="text"
                className="form-control form-control-large"
                id="tokenName"
                placeholder="Epic Moon Rocket"
                value={tokenArgs.metadata.name}
                onChange={(e) => {
                  const tokenName = e.target.value;
                  setTokenArgs((prevArgs) => ({
                    ...prevArgs,
                    metadata: {
                      ...prevArgs.metadata,
                      name: tokenName
                    }
                  }));
                }}
              />
            </div>
            <small>The token name may be used to display the token in the UI</small>
          </div>

          <div className="form-group">
            <label htmlFor="tokenId">Token Symbol</label>
            <div className="input-group">
              <input
                type="text"
                className={tokenIdClass()}
                id="tokenId"
                placeholder="MOON"
                value={tokenArgs.metadata.symbol}
                onChange={async (e) => {
                  const tokenId = e.target.value;
                  setTokenArgs((prevArgs) => ({
                    ...prevArgs,
                    metadata: {
                      ...prevArgs.metadata,
                      symbol: tokenId
                    },
                    tokenSymbolStatus: 'loading'
                  }));

                  await doesTokenExist(tokenId);
                }}
              />
            </div>
            {tokenArgs.tokenSymbolStatus === 'invalid' && (
              <div>
                <small>
                  <b>Token Symbol already exists.</b>
                </small>
              </div>
            )}
            <small>
              It'll be used to identify the token and to create an Account ID for the token
              <code>
                {tokenArgs.metadata.symbol
                  ? tokenArgs.metadata.symbol.toLowerCase() + '.' + ContractName
                  : ''}
              </code>
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="totalSupply">Total Supply</label>
            <div className="input-group">
              <input
                type="number"
                className="form-control form-control-large"
                id="totalSupply"
                placeholder="1000000000"
                value={+tokenArgs.total_supply}
                onChange={(e) => {
                  const validateTotalSupply = (value: string) => {
                    const num = BigInt(value);
                    if (num > BigInt(0) && num <= BigInt(MaxU128)) {
                      return value;
                    } else {
                      return '1';
                    }
                  };
                  const totalSupply = validateTotalSupply(e.target.value);

                  setTokenArgs((prevArgs) => ({
                    ...prevArgs,
                    total_supply: totalSupply
                  }));
                }}
              />
            </div>
            <small>This is a total number of tokens to mint.</small>
          </div>

          <div className="form-group">
            <label htmlFor="tokenDecimals">Token Decimals</label>
            <div className="input-group">
              <input
                type="number"
                className="form-control form-control-large"
                id="tokenDecimals"
                placeholder="18"
                value={tokenArgs.metadata.decimals}
                onChange={(e) => {
                  const decimals = Math.max(0, Math.min(24, parseInt(e.target.value)));

                  setTokenArgs((prevArgs) => ({
                    ...prevArgs,
                    metadata: {
                      ...prevArgs.metadata,
                      decimals
                    }
                  }));
                }}
              />
            </div>
            <small>
              Tokens operate on integer numbers.
              <code>1 / 10**{tokenArgs.metadata.decimals}</code> is the smallest fractional value of
              the new token.
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="tokenIcon">Token Icon</label>
            <div className="input-group">
              <div>
                {tokenArgs.metadata.icon && (
                  <img
                    className="rounded token-icon"
                    style={{ marginRight: '1em' }}
                    src={tokenArgs.metadata.icon}
                    alt="Token Icon"
                  />
                )}
              </div>
              <div>
                <section className="container">
                  <div {...getRootProps({ className: 'dropzone' })}>
                    <input {...getInputProps()} />
                    <p>Drag 'n' drop some files here, or click to select files</p>
                  </div>
                </section>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="ownerId">Owner Account ID</label>
            <div className="input-group">
              <input
                type="text"
                className={ownerIdClass()}
                id="ownerId"
                placeholder={wallet.accountId || ''}
                value={tokenArgs.owner_id}
                onChange={async (e) => {
                  const rawAccountId = e.target.value;
                  setTokenArgs((prevArgs) => ({
                    ...prevArgs,
                    owner_id: rawAccountId,
                    ownerStatus: 'loading'
                  }));
                  await validateOwnerAccount(rawAccountId);
                }}
              />
            </div>
            {tokenArgs.ownerStatus === 'invalid' && (
              <div>
                <small>
                  <b>Account doesn't exists.</b>
                </small>
              </div>
            )}
            <small>This account will own the total supply of the newly created token</small>
          </div>
          <div className="form-group">
            <div>
              <button className="btn btn-success" onClick={createToken}>
                Create Token ({fromYocto(requiredDeposit)} Ⓝ)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OptionsSection;
