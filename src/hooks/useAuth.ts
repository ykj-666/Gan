import { trpc } from "@/providers/trpc";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { LOGIN_PATH } from "@/const";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = LOGIN_PATH } =
    options ?? {};

  const navigate = useNavigate();
  const utils = trpc.useUtils();

  // Check auth tokens
  const [localToken] = useState<string | null>(() =>
    localStorage.getItem("local_auth_token")
  );
  const [wechatToken] = useState<string | null>(() =>
    localStorage.getItem("wechat_auth_token")
  );

  // Query all three auth systems
  const { data: oauthUser, isLoading: oauthLoading } =
    trpc.auth.me.useQuery(undefined, {
      staleTime: 1000 * 60 * 5,
      retry: false,
    });

  const { data: localUser, isLoading: localLoading } =
    trpc.localAuth.me.useQuery(undefined, {
      staleTime: 1000 * 60 * 5,
      retry: false,
      enabled: !!localToken && !oauthUser,
    });

  const { data: wechatUser, isLoading: wechatLoading } =
    trpc.wechatAuth.me.useQuery(undefined, {
      staleTime: 1000 * 60 * 5,
      retry: false,
      enabled: !!wechatToken && !oauthUser && !localUser,
    });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
    },
  });

  const isLoading = oauthLoading || localLoading || wechatLoading;

  // Merge user data - OAuth takes precedence, then local, then WeChat
  const user = oauthUser ?? localUser ?? wechatUser ?? null;

  const logout = useCallback(() => {
    // Clear all auth systems
    localStorage.removeItem("local_auth_token");
    localStorage.removeItem("wechat_auth_token");
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        window.location.href = redirectPath;
      },
    });
  }, [logoutMutation, redirectPath]);

  useEffect(() => {
    if (redirectOnUnauthenticated && !isLoading && !user) {
      const currentPath = window.location.pathname;
      if (currentPath !== redirectPath) {
        navigate(redirectPath);
      }
    }
  }, [redirectOnUnauthenticated, isLoading, user, navigate, redirectPath]);

  return useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading: isLoading || logoutMutation.isPending,
      logout,
    }),
    [user, isLoading, logoutMutation.isPending, logout],
  );
}
