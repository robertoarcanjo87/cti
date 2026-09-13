import { requireChatGPTUser } from "./chatgpt-auth";
import { CtiApp } from "@/components/cti-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <CtiApp signedInName={user.displayName} />;
}
