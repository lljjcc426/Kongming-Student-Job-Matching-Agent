import { useEffect, useState } from "react";
import {
  getCachedIdentity,
  loadAuthStatus,
  loginAccount,
  loginDemoAccount,
  logoutAccount,
  recoverAccount,
  registerAccount,
  type AppIdentity,
} from "./identityClient";

export function useIdentity() {
  const [identity, setIdentity] = useState<AppIdentity>(getCachedIdentity);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void loadAuthStatus()
      .then((storedIdentity) => {
        if (active) setIdentity(storedIdentity);
      })
      .catch(() => {
        if (active) setIdentity((current) => ({ ...current, authenticated: false }));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const register = async (nickname: string, password: string) => {
    const result = await registerAccount(nickname, password);
    setIdentity(result.identity);
    return result;
  };

  const login = async (nickname: string, password: string) => {
    const loggedIn = await loginAccount(nickname, password);
    setIdentity(loggedIn);
  };

  const recover = async (nickname: string, recoveryCode: string, password: string) => {
    const recovered = await recoverAccount(nickname, recoveryCode, password);
    setIdentity(recovered);
  };

  const loginDemo = async () => {
    const demo = await loginDemoAccount();
    setIdentity(demo);
  };

  const logout = async () => {
    const loggedOut = await logoutAccount();
    setIdentity(loggedOut);
    setDialogOpen(false);
  };

  return {
    identity,
    loading,
    dialogOpen,
    openDialog: () => setDialogOpen(true),
    closeDialog: () => setDialogOpen(false),
    register,
    login,
    recover,
    loginDemo,
    logout,
  };
}
