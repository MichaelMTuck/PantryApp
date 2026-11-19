// Components/PushRegistrar.js
import { useEffect } from "react";
import { useSession } from "../Services/session";
import { apiRequest } from "../Services/api";
import { registerForPush } from "../Services/notifications"; 

export default function PushRegistrar() {
  const { token } = useSession();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const pushToken = await registerForPush();
        if (pushToken && active) {
          await apiRequest("/push-tokens", {
            method: "POST",
            token,
            body: { token: pushToken },
          });
        }
      } catch {
        // Notifications are optional; don't block the app
      }
    })();
    return () => { active = false; };
  }, [token]);

  return null;
}