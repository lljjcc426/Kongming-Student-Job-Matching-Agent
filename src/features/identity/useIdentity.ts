import { useEffect, useState } from "react";
import {
  continueAsAnonymous,
  createIdentity,
  getCachedIdentity,
  hasCompletedIdentityChoice,
  loadIdentityStatus,
  restoreIdentity,
  startFreshExperience,
  type AppIdentity,
} from "./identityClient";

export function useIdentity() {
  const [identity, setIdentity] = useState<AppIdentity>(getCachedIdentity);
  const [dialogOpen, setDialogOpen] = useState(() => !hasCompletedIdentityChoice());

  useEffect(() => {
    let active = true;
    void loadIdentityStatus()
      .then((storedIdentity) => {
        if (!active) return;
        setIdentity(storedIdentity);
        if (storedIdentity.registered) setDialogOpen(false);
      })
      .catch(() => {
        // 本地身份仍可继续使用，服务恢复后会在下一次请求中重新校验。
      });
    return () => {
      active = false;
    };
  }, []);

  const create = async (nickname: string) => {
    const result = await createIdentity(nickname);
    setIdentity(result.identity);
    return result.recoveryCode;
  };

  const restore = async (nickname: string, recoveryCode: string) => {
    const restored = await restoreIdentity(nickname, recoveryCode);
    setIdentity(restored);
    setDialogOpen(false);
  };

  const continueAnonymous = () => {
    setIdentity(continueAsAnonymous());
    setDialogOpen(false);
  };

  const logout = () => {
    setIdentity(startFreshExperience(false));
    setDialogOpen(true);
  };

  const startFresh = () => {
    setIdentity(startFreshExperience(true));
    setDialogOpen(false);
  };

  return {
    identity,
    dialogOpen,
    openDialog: () => setDialogOpen(true),
    closeDialog: () => setDialogOpen(false),
    create,
    restore,
    continueAnonymous,
    logout,
    startFresh,
  };
}
