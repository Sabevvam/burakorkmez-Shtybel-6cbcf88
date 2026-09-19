import { create } from "zustand";
import { persist } from "zustand/middleware";

import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import toast from "react-hot-toast";

export const useChatStore = create(
  persist(
    (set, get) => ({
      users: [],
      conversations: [],
      messages: [],
      selectedUser: null,
      isConversationsLoading: false,
      isUsersLoading: false,
      isMessagesLoading: false,
      activeConversationId: null,
      searchQuery: "",
      sidebarTab: "chats",
      composerText: "",
      isSoundEnabled: true,
      isSendingMedia: false,

      getUsers: async () => {
        set({ isUsersLoading: true });
        try {
          const res = await axiosInstance.get("/messages/users");
          set((state) => ({
            users: res.data,
            selectedUser:
              state.selectedUser &&
              res.data.some((user) => user._id === state.selectedUser._id)
                ? state.selectedUser
                : null,
          }));
        } catch (error) {
          console.log("Error in get Users", error.message);
        } finally {
          set({ isUsersLoading: false });
        }
      },

      getConversations: async () => {
        set({ isConversationsLoading: true });
        try {
          const res = await axiosInstance.get("/messages/conversations");
          set({ conversations: res.data });
        } catch (error) {
          console.log("Error in getConversations", error.message);
        } finally {
          set({ isConversationsLoading: false });
        }
      },

      getMessages: async (userId) => {
        if (!userId) return;

        if (String(userId).startsWith("group-")) {
          set({ messages: [] });
          return;
        }

        set({ isMessagesLoading: true });
        try {
          const res = await axiosInstance.get(`/messages/${userId}`);
          set({ messages: res.data });
        } catch (error) {
          toast.error(
            error.response?.data?.message || "Failed to load messages",
          );
        } finally {
          set({ isMessagesLoading: false });
        }
      },

      sendMessage: async (messageData) => {
        const { selectedUser, messages } = get();
        if (!selectedUser) return false;

        if (selectedUser.isGroup) {
          const authUser = useAuthStore.getState().authUser;
          const localMessage = {
            _id: `group-message-${Date.now()}`,
            senderId: authUser?._id || "me",
            receiverId: selectedUser._id,
            text:
              typeof messageData === "string"
                ? messageData
                : messageData?.text || "",
            image:
              typeof messageData === "string" ? "" : messageData?.image || "",
            gif: typeof messageData === "string" ? "" : messageData?.gif || "",
            audio:
              typeof messageData === "string" ? "" : messageData?.audio || "",
            video:
              typeof messageData === "string" ? "" : messageData?.video || "",
            createdAt: new Date().toISOString(),
            reactions: [],
          };

          set({ messages: [...messages, localMessage], composerText: "" });
          get().getConversations();
          return true;
        }

        try {
          const res = await axiosInstance.post(
            `/messages/send/${selectedUser._id}`,
            messageData,
          );
          set({ messages: [...messages, res.data], composerText: "" });
          get().getConversations();
          return true;
        } catch (error) {
          toast.error(
            error.response?.data?.message || "Failed to send message",
          );
          return false;
        }
      },

      subscribeToMessages: (userId) => {
        if (!userId) return;

        const socket = useAuthStore.getState().socket;
        if (!socket) return;

        socket.off("newMessage");
        socket.on("newMessage", (newMessage) => {
          // if im not the receiver don't do anything just return
          if (String(newMessage.senderId) !== String(userId)) return;

          set({ messages: [...get().messages, newMessage] });

          get().getConversations();
        });
      },

      unsubscribeFromMessages: () => {
        const socket = useAuthStore.getState().socket;
        socket?.off("newMessage");
      },

      setSelectedUser: (selectedUser) => set({ selectedUser }),

      setActiveConversationId: (activeConversationId) => {
        set((state) => ({
          activeConversationId,
          selectedUser:
            state.users.find((user) => user._id === activeConversationId) ||
            state.conversations.find(
              (user) => user._id === activeConversationId,
            ) ||
            null,
          messages: activeConversationId ? state.messages : [],
        }));
      },

      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSidebarTab: (sidebarTab) => set({ sidebarTab }),
      setComposerText: (composerText) => set({ composerText }),
      setSoundEnabled: (isSoundEnabled) => set({ isSoundEnabled }),

      createGroupConversation: ({
        name,
        imageUrl = "",
        selectedUserIds = [],
      }) => {
        const trimmedName = (name || "New Group").trim() || "New Group";
        const nextGroup = {
          _id: `group-${Date.now()}`,
          fullName: trimmedName,
          profilePic: imageUrl,
          email: `${trimmedName.toLowerCase().replace(/\s+/g, "-")}@group.local`,
          isGroup: true,
          members: selectedUserIds,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          conversations: [nextGroup, ...state.conversations],
          activeConversationId: nextGroup._id,
          selectedUser: nextGroup,
          messages: [],
        }));

        return nextGroup;
      },

      reactToMessage: (messageId, emoji) => {
        set((state) => ({
          messages: state.messages.map((message) => {
            if (String(message._id) !== String(messageId)) return message;

            const existingReaction = (message.reactions || []).find(
              (reaction) => reaction.emoji === emoji,
            );

            if (existingReaction) {
              const alreadyReacted = (existingReaction.users || []).some(
                (userId) =>
                  String(userId) ===
                  String(useAuthStore.getState().authUser?._id),
              );

              return {
                ...message,
                reactions: (message.reactions || []).map((reaction) => {
                  if (reaction.emoji !== emoji) return reaction;

                  const users = (reaction.users || []).filter(
                    (userId) =>
                      String(userId) !==
                      String(useAuthStore.getState().authUser?._id),
                  );

                  return {
                    ...reaction,
                    users: alreadyReacted
                      ? users
                      : [
                          ...users,
                          useAuthStore.getState().authUser?._id,
                        ].filter(Boolean),
                    count: alreadyReacted
                      ? Math.max((reaction.count || 0) - 1, 0)
                      : (reaction.count || 0) + 1,
                  };
                }),
              };
            }

            return {
              ...message,
              reactions: [
                ...(message.reactions || []),
                {
                  emoji,
                  count: 1,
                  users: [useAuthStore.getState().authUser?._id].filter(
                    Boolean,
                  ),
                },
              ],
            };
          }),
        }));
      },

      sendTextMessage: async (conversationId) => {
        const messageText = get().composerText.trim();
        if (!conversationId || !messageText) return false;

        return get().sendMessage({ text: messageText });
      },

      sendMediaMessage: async ({ conversationId, file }) => {
        if (!conversationId || !file) return false;

        const formData = new FormData();
        formData.append("media", file);

        set({ isSendingMedia: true });
        try {
          return await get().sendMessage(formData);
        } finally {
          set({ isSendingMedia: false });
        }
      },
    }),
    {
      name: "e-message-storage",
      partialize: (state) => ({
        isSoundEnabled: state.isSoundEnabled,
        conversations: state.conversations,
        activeConversationId: state.activeConversationId,
        selectedUser: state.selectedUser,
        messages: state.messages,
      }),
    },
  ),
);
