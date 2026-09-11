import { Suspense } from "react";
import { ScreenMessage } from "@/components/profiles/pin-dialog";
import ProfilesForm from "./profiles-form";

export default function ProfilesPage() {
  return (
    <Suspense fallback={<ScreenMessage>Loading profiles...</ScreenMessage>}>
      <ProfilesForm />
    </Suspense>
  );
}
