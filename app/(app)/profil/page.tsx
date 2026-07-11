import { getMyProfile } from "./actions";
import { ProfileClient } from "./profile-client";

export default async function ProfilPage() {
  const profile = await getMyProfile();
  return <ProfileClient profile={profile} />;
}
