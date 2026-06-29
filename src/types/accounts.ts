export interface MalAccountSummary {
  id: string;
  mal_user_id: number;
  display_name: string;
  avatar_url: string | null;
  is_active: boolean;
  has_session: boolean;
}
