import { trpc } from "@/providers/trpc";
import { useCallback, useEffect, useMemo } from "react";
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

  // Query all three auth systems in parallel
  const { data: oauthUser, isLoading: oauthLoading } =
    trpc.auth.me.useQuery(undefined, {
      staleTime: 1000 * 60 * 5,
      retry: false,
    });

  const { data: localUser, isLoading: localLoading } =
    trpc.localAuth.me.useQuery(undefined, {
      staleTime: 1000 * 60 * 5,
      retry: false,
    });

  const { data: wechatUser, isLoading: wechatLoading } =
    trpc.wechatAuth.me.useQuery(undefined, {
      staleTime: 1000 * 60 * 5,
      retry: false,
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
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        navigate(redirectPath, { replace: true });
      },
    });
  }, [logoutMutation, redirectPath, navigate]);

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
