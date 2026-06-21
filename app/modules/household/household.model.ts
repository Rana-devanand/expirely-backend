export interface IHousehold {
  id: string;
  name: string;
  owner_id: string;
  join_code: string;
  created_at: string;
}

export interface IHouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  role: "OWNER" | "MEMBER";
  joined_at: string;
  username?: string;
  avatar_url?: string;
}

export interface ICreateHousehold {
  name: string;
}

export interface IHouseholdWithMembers extends IHousehold {
  members: IHouseholdMember[];
}
