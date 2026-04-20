export interface TreasuryBalance {
  source: string;
  address: string;
  note: string;
  tokenAmount: number;
}

export interface LockerEntry {
  address: string;      // locker PDA address
  ownerAddress?: string; // user's actual wallet address
  lockedAmount: number;
  votingWeight: number;
  votingWeightUsed: number;
  lockedAt: number;   // unix seconds
  unlocksAt: number;  // unix seconds
}

export interface Snapshot {
  timestamp: number;
  treasury: TreasuryBalance[];
  lockers: LockerEntry[];
  totalLocked: number;
  totalStaked: number;
  totalInControl: number;
  totalSupply: number;
}

export type Labels = Record<string, string>;

export interface HolderEntry {
  address: string;         // wallet address
  walletBalance: number;   // tokens sitting in wallet
  stakedAmount: number;    // tokens in staking contract
  lockedAmount: number;    // tokens in vote-lock contract
  totalBalance: number;    // sum of all three
  categories: ('holder' | 'staker' | 'locker')[];
}

export interface HoldersSnapshot {
  timestamp: number;
  holders: HolderEntry[];
  minBalance: number;
}
