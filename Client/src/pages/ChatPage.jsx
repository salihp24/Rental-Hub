import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { io } from "socket.io-client";
import api from "../lib/api";
import { resolveSocketUrl } from "../lib/socket";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Textarea from "../components/ui/Textarea";

const CONVERSATIONS_POLL_MS = 120000;
const MESSAGES_POLL_MS = 90000;

const formatConversationTime = (value) => {
  if (!value) return "";

  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  return new Intl.DateTimeFormat(undefined, sameDay
    ? { hour: "numeric", minute: "2-digit" }
    : { day: "numeric", month: "short" }).format(date);
};

const formatMessageTime = (value) => {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

const getImageUrl = (product) =>
  product?.images?.[0]?.url || "";

const money = (value, currency = "INR") => {
  const num = Number(value || 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return `${currency} ${num}`;
  }
};

function getOtherParticipant(conversation, currentUserId) {
  const participants = Array.isArray(conversation?.participants)
    ? conversation.participants
    : [];

  return (
    participants.find((participant) => participant?._id !== currentUserId) ||
    participants[0] ||
    null
  );
}

function buildConversationTitle(conversation, currentUserId) {
  if (conversation?.title?.trim()) return conversation.title.trim();

  const other = getOtherParticipant(conversation, currentUserId);
  if (other?.name) return other.name;
  if (other?.email) return other.email;
  if (conversation?.product?.title) return conversation.product.title;
  return "Conversation";
}

function buildConversationSubtitle(conversation, currentUserId) {
  if (conversation?.product?.title) return conversation.product.title;

  const other = getOtherParticipant(conversation, currentUserId);
  if (other?.email) return other.email;
  return "Direct chat";
}

export default function ChatPage() {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedConversationId = searchParams.get("conversation") || "";
  const bookingId = searchParams.get("booking") || "";
  const productId = searchParams.get("product") || "";
  const participantId = searchParams.get("participant") || "";
  const initialPricingUnit = searchParams.get("pricingUnit") === "weekly" ? "weekly" : "daily";
  const initialStartDate = searchParams.get("startDate") || "";
  const initialEndDate = searchParams.get("endDate") || "";

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [offerPricingUnit, setOfferPricingUnit] = useState(initialPricingUnit);
  const [offerStartDate, setOfferStartDate] = useState(initialStartDate);
  const [offerEndDate, setOfferEndDate] = useState(initialEndDate);
  const [sending, setSending] = useState(false);
  const [offerBusy, setOfferBusy] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [error, setError] = useState("");
  const socketRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const selectedConversationIdRef = useRef("");
  const userIdRef = useRef("");

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    userIdRef.current = user?._id || "";
  }, [user?._id]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation._id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );
  const isOwnerInSelectedConversation =
    selectedConversation?.product?.owner &&
    String(selectedConversation.product.owner?._id || selectedConversation.product.owner) === String(user?._id);
  const canNegotiateBooking =
    selectedConversation?.booking &&
    ["pending", "confirmed"].includes(selectedConversation.booking.status) &&
    selectedConversation.booking.paymentStatus !== "paid";
  const canNegotiate =
    selectedConversation?.product?._id &&
    (!selectedConversation?.booking || canNegotiateBooking) &&
    !isOwnerInSelectedConversation;

  const replaceConversationParam = useCallback(
    (conversationId) => {
      const next = new URLSearchParams();
      if (conversationId) next.set("conversation", conversationId);
      setSearchParams(next, { replace: true });
    },
    [setSearchParams]
  );

  const upsertConversation = useCallback((nextConversation) => {
    if (!nextConversation?._id) return;

    setConversations((current) => {
      const filtered = current.filter(
        (conversation) => conversation._id !== nextConversation._id
      );
      return [nextConversation, ...filtered];
    });
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const res = await api.get("/chat", { params: { limit: 50 } });
      setConversations(res.data?.data?.conversations || []);
      return res.data?.data?.conversations || [];
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Could not load conversations.");
      return [];
    }
  }, []);

  const ensureConversation = useCallback(async () => {
    if (selectedConversationId) return selectedConversationId;

    if (bookingId) {
      const res = await api.post("/chat", { bookingId });
      const conversation = res.data?.data?.conversation;
      if (conversation?._id) {
        replaceConversationParam(conversation._id);
        return conversation._id;
      }
      return "";
    }

    if (productId && participantId) {
      const existingRes = await api.get("/chat", { params: { product: productId, limit: 100 } });
      const existing = (existingRes.data?.data?.conversations || []).find((conversation) =>
        Array.isArray(conversation.participants) &&
        conversation.participants.some((participant) => participant?._id === participantId)
      );

      if (existing?._id) {
        replaceConversationParam(existing._id);
        return existing._id;
      }

      const res = await api.post("/chat", {
        participantIds: [participantId],
        productId,
      });
      const conversation = res.data?.data?.conversation;
      if (conversation?._id) {
        replaceConversationParam(conversation._id);
        return conversation._id;
      }
    }

    return "";
  }, [bookingId, participantId, productId, replaceConversationParam, selectedConversationId]);

  const loadMessages = useCallback(async (conversationId) => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    setMessagesLoading(true);

    try {
      const res = await api.get(`/chat/${conversationId}/messages`, {
        params: { limit: 100 },
      });
      setMessages(res.data?.data?.messages || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Could not load messages.");
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user?._id) return undefined;

    const socket = io(resolveSocketUrl(), {
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("chat:message", ({ conversationId, message }) => {
      if (!conversationId || !message) return;

      if (conversationId === selectedConversationIdRef.current) {
        setMessages((current) =>
          current.some((item) => item._id === message._id)
            ? current
            : [...current, message]
        );

        if (message.sender?._id !== userIdRef.current) {
          socket.emit("chat:conversation:read", { conversationId });
          setConversations((current) =>
            current.map((conversation) =>
              conversation._id === conversationId
                ? { ...conversation, unreadCount: 0 }
                : conversation
            )
          );
        }
      }
    });

    socket.on("chat:conversation:updated", ({ conversation }) => {
      upsertConversation(conversation);
    });

    socket.on("connect_error", (connectError) => {
      setError(connectError?.message || "Could not connect to live chat.");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [upsertConversation, user?._id]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !selectedConversationId) return undefined;

    socket.emit("chat:join", { conversationId: selectedConversationId });

    return () => {
      socket.emit("chat:leave", { conversationId: selectedConversationId });
    };
  }, [selectedConversationId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setListLoading(true);
      setBootstrapping(true);
      setError("");

      try {
        const conversationId = await ensureConversation();
        if (cancelled) return;

        const loaded = await loadConversations();
        if (cancelled) return;

        const nextSelected =
          conversationId ||
          selectedConversationId ||
          loaded[0]?._id ||
          "";

        if (nextSelected && nextSelected !== selectedConversationId) {
          replaceConversationParam(nextSelected);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || err.message || "Could not open chat.");
        }
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
          setListLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    ensureConversation,
    loadConversations,
    replaceConversationParam,
    selectedConversationId,
  ]);

  useEffect(() => {
    (async () => {
      if (!selectedConversationId) {
        setMessages([]);
        return;
      }

      await loadMessages(selectedConversationId);
    })();
  }, [loadMessages, selectedConversationId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextAmount =
        selectedConversation?.negotiation?.finalRate ??
        selectedConversation?.product?.pricing?.daily?.rate ??
        "";
      setOfferAmount(nextAmount ? String(nextAmount) : "");
      setOfferPricingUnit(initialPricingUnit || "daily");
      setOfferStartDate(initialStartDate || "");
      setOfferEndDate(initialEndDate || "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    initialEndDate,
    initialPricingUnit,
    initialStartDate,
    selectedConversation?._id,
    selectedConversation?.negotiation?.finalRate,
    selectedConversation?.product?.pricing?.daily?.rate,
  ]);

  useEffect(() => {
    if (!selectedConversationId || !selectedConversation?.unreadCount) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const socket = socketRef.current;
        if (socket?.connected) {
          socket.emit("chat:conversation:read", { conversationId: selectedConversationId });
        } else {
          await api.post(`/chat/${selectedConversationId}/read`);
        }
        if (cancelled) return;

        setConversations((current) =>
          current.map((conversation) =>
            conversation._id === selectedConversationId
              ? { ...conversation, unreadCount: 0 }
              : conversation
          )
        );
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || err.message || "Could not update read state.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedConversation?.unreadCount, selectedConversationId]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return undefined;

    const conversationsTimer = window.setInterval(() => {
      loadConversations();
    }, CONVERSATIONS_POLL_MS);

    const messagesTimer = window.setInterval(() => {
      loadMessages(selectedConversationId);
    }, MESSAGES_POLL_MS);

    return () => {
      window.clearInterval(conversationsTimer);
      window.clearInterval(messagesTimer);
    };
  }, [loadConversations, loadMessages, selectedConversationId]);

  const handleSend = useCallback(async (event) => {
    event.preventDefault();

    const text = composerText.trim();
    if (!text || !selectedConversationId) return;

    setSending(true);
    setError("");

    try {
      let nextMessage = null;
      let nextConversation = null;
      const socket = socketRef.current;

      if (socket?.connected) {
        const ack = await new Promise((resolve) => {
          socket.emit(
            "chat:message:send",
            { conversationId: selectedConversationId, text },
            resolve
          );
        });

        if (!ack?.ok) {
          throw new Error(ack?.message || "Could not send message.");
        }

        nextMessage = ack.message || null;
        nextConversation = ack.conversation || null;
      } else {
        const res = await api.post(`/chat/${selectedConversationId}/messages`, { text });
        nextMessage = res.data?.data?.message;
        nextConversation = res.data?.data?.conversation;
      }

      if (nextMessage) {
        setMessages((current) =>
          current.some((message) => message._id === nextMessage._id)
            ? current
            : [...current, nextMessage]
        );
      }

      if (nextConversation?._id) {
        upsertConversation({ ...nextConversation, unreadCount: 0 });
      } else {
        await loadConversations();
      }

      setComposerText("");
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Could not send message.");
    } finally {
      setSending(false);
    }
  }, [composerText, loadConversations, selectedConversationId, upsertConversation]);

  const handleSendOffer = useCallback(async () => {
    if (!selectedConversationId || !offerAmount) return;

    setOfferBusy(true);
    setError("");

    try {
      const payload = {
        amount: Number(offerAmount),
      };

      if (!selectedConversation?.booking) {
        payload.pricingUnit = offerPricingUnit || "daily";
        payload.startDate = offerStartDate;
        payload.endDate = offerEndDate;
      }

      const res = await api.post(`/chat/${selectedConversationId}/offers`, payload);
      const nextMessage = res.data?.data?.message;
      const nextConversation = res.data?.data?.conversation;

      if (nextMessage) {
        setMessages((current) =>
          current.some((message) => message._id === nextMessage._id)
            ? current
            : [...current, nextMessage]
        );
      }

      if (nextConversation?._id) {
        upsertConversation({ ...nextConversation, unreadCount: 0 });
      } else {
        await loadConversations();
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Could not send your price request.");
    } finally {
      setOfferBusy(false);
    }
  }, [
    loadConversations,
    offerAmount,
    offerPricingUnit,
    offerEndDate,
    offerStartDate,
    selectedConversation,
    selectedConversationId,
    upsertConversation,
  ]);

  const handleOfferResponse = useCallback(async (messageId, action) => {
    if (!selectedConversationId || !messageId) return;

    setOfferBusy(true);
    setError("");

    try {
      const res = await api.post(`/chat/${selectedConversationId}/offers/${messageId}/respond`, {
        action,
      });
      const nextMessage = res.data?.data?.message;
      const nextConversation = res.data?.data?.conversation;

      if (nextMessage) {
        setMessages((current) =>
          current.map((message) => (message._id === nextMessage._id ? nextMessage : message))
        );
      }

      if (nextConversation?._id) {
        upsertConversation({ ...nextConversation, unreadCount: 0 });
      } else {
        await loadConversations();
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Could not update the price request.");
    } finally {
      setOfferBusy(false);
    }
  }, [loadConversations, selectedConversationId, upsertConversation]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-wide text-black/45">
            Messages
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-black md:text-3xl">
            Conversations with owners and renters
          </h1>
          <p className="mt-2 text-sm font-semibold text-black/60">
            Keep all booking questions and updates in one place.
          </p>
        </div>
        <Button variant="secondary" as={Link} to="/account">
          Back to Account
        </Button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid h-[calc(100vh-140px)] min-h-[680px] gap-6 lg:grid-cols-[340px_1fr]">
        <aside className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm shadow-black/5">
          <div className="border-b border-black/10 px-5 py-4">
            <div className="text-sm font-extrabold text-black">Conversations</div>
            <div className="mt-1 text-xs font-semibold text-black/50">
              {conversations.length} conversation{conversations.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="h-full max-h-[calc(100vh-260px)] overflow-y-auto">
            {listLoading || bootstrapping ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-20 animate-pulse rounded-2xl bg-black/[0.04]"
                  />
                ))}
              </div>
            ) : conversations.length ? (
              <div className="space-y-2 p-3">
                {conversations.map((conversation) => {
                  const other = getOtherParticipant(conversation, user?._id);
                  const isActive = conversation._id === selectedConversationId;
                  const title = buildConversationTitle(conversation, user?._id);
                  const subtitle = buildConversationSubtitle(conversation, user?._id);
                  const imageUrl = getImageUrl(conversation.product);

                  return (
                    <button
                      key={conversation._id}
                      type="button"
                      onClick={() => replaceConversationParam(conversation._id)}
                      className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                        isActive
                          ? "border-black/20 bg-[#FFF7D1]"
                          : "border-transparent hover:border-black/10 hover:bg-black/[0.02]"
                      }`}
                    >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt=""
                          className="h-12 w-12 rounded-2xl object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/[0.05] text-sm font-extrabold text-black/45">
                          {(other?.name || title || "C").slice(0, 1).toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="truncate text-sm font-extrabold text-black">{title}</div>
                          <div className="shrink-0 text-[11px] font-semibold text-black/45">
                            {formatConversationTime(
                              conversation.lastMessageAt || conversation.updatedAt
                            )}
                          </div>
                        </div>
                        <div className="mt-1 truncate text-xs font-semibold text-black/50">
                          {subtitle}
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <div className="truncate text-xs font-semibold text-black/55">
                            {conversation.lastMessageText || "No messages yet"}
                          </div>
                          {conversation.unreadCount ? (
                            <span className="rounded-full bg-black px-2 py-0.5 text-[11px] font-extrabold text-white">
                              {conversation.unreadCount}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-5 text-sm font-semibold text-black/50">
                No conversations yet. Start a conversation from a product or booking page.
              </div>
            )}
          </div>
        </aside>

        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm shadow-black/5">
          {selectedConversation ? (
            <>
              <div className="border-b border-black/10 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-extrabold text-black">
                      {buildConversationTitle(selectedConversation, user?._id)}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-black/55">
                      {buildConversationSubtitle(selectedConversation, user?._id)}
                      {selectedConversation.booking?.orderCode
                        ? ` | Order ${selectedConversation.booking.orderCode}`
                        : ""}
                    </div>
                  </div>
                  {selectedConversation.product?._id ? (
                    <Button
                      variant="secondary"
                      as={Link}
                      to={`/products/${selectedConversation.product.slug || selectedConversation.product._id}`}
                    >
                      View product
                    </Button>
                  ) : null}
                </div>
                {selectedConversation.negotiation?.status === "accepted" &&
                selectedConversation.negotiation?.finalRate ? (
                  <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                    Agreed price for this conversation:{" "}
                    {money(
                      selectedConversation.negotiation.finalRate,
                      selectedConversation.negotiation.currency || "INR"
                    )}{" "}
                    per {selectedConversation.negotiation.finalPricingUnit || "day"}.
                  </div>
                ) : null}
                {selectedConversation.negotiation?.status === "pending" ? (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                    A price request is waiting for the owner?s response.
                  </div>
                ) : null}
                {selectedConversation.booking && canNegotiateBooking ? (
                  <div className="mt-3 rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm font-semibold text-black/65">
                    Price discussion is available until payment is completed.
                  </div>
                ) : null}
              </div>

              <div
                ref={messagesContainerRef}
                className="flex-1 space-y-3 overflow-y-auto bg-[#FFF7D1]/25 p-5"
              >
                {messagesLoading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-16 animate-pulse rounded-2xl bg-white"
                    />
                  ))
                ) : messages.length ? (
                  messages.map((message) => {
                    const mine = message.sender?._id === user?._id;
                    const isPendingOffer = message.type === "offer" && message.offer?.status === "pending";
                    const canOwnerRespondToOffer =
                      isPendingOffer &&
                      isOwnerInSelectedConversation &&
                      !mine;
                    const canRenterCancelOffer =
                      isPendingOffer &&
                      !isOwnerInSelectedConversation &&
                      mine;

                    return (
                      <div
                        key={message._id}
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-3xl px-4 py-3 shadow-sm ${
                            mine
                              ? "bg-black text-white"
                              : "border border-black/10 bg-white text-black"
                          }`}
                        >
                          {!mine ? (
                            <div className="text-[11px] font-extrabold uppercase opacity-60">
                              {message.sender?.name || message.sender?.email || "User"}
                            </div>
                          ) : null}
                          {message.type === "offer" ? (
                            <div className="mt-1 space-y-3">
                              <div className="text-sm font-extrabold">
                                Offered{" "}
                                {money(
                                  message.offer?.amount,
                                  message.offer?.currency || selectedConversation?.product?.pricing?.currency || "INR"
                                )}{" "}
                                per {message.offer?.pricingUnit || "day"}
                              </div>
                              <div className={`text-xs font-semibold ${
                                mine ? "text-white/75" : "text-black/55"
                              }`}>
                                Current status: {message.offer?.status || "pending"}
                              </div>
                              {canOwnerRespondToOffer ? (
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    disabled={offerBusy}
                                    onClick={() => handleOfferResponse(message._id, "accepted")}
                                  >
                                    Accept
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={offerBusy}
                                    onClick={() => handleOfferResponse(message._id, "rejected")}
                                  >
                                    Reject
                                  </Button>
                                </div>
                              ) : null}
                              {canRenterCancelOffer ? (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  disabled={offerBusy}
                                  onClick={() => handleOfferResponse(message._id, "cancelled")}
                                >
                                  Cancel Request
                                </Button>
                              ) : null}
                            </div>
                          ) : (
                          <div className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-relaxed">
                            {message.text}
                          </div>
                          )}
                          <div
                            className={`mt-2 text-[11px] font-semibold ${
                              mine ? "text-white/65" : "text-black/45"
                            }`}
                          >
                            {formatMessageTime(message.createdAt)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex h-full items-center justify-center text-sm font-semibold text-black/45">
                    No messages yet. Send a message to start the conversation.
                  </div>
                )}
              </div>

              <form
                onSubmit={handleSend}
                className="border-t border-black/10 bg-white p-4"
              >
                <div className="flex flex-col gap-3">
                  {canNegotiate ? (
                    <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-end">
                        <label className="flex-1 space-y-2">
                          <span className="text-xs font-extrabold text-black/70">
                            Request a price
                          </span>
                          <Input
                            type="number"
                            min="1"
                            step="0.01"
                            value={offerAmount}
                            onChange={(event) => setOfferAmount(event.target.value)}
                            placeholder="Enter your requested amount"
                          />
                        </label>
                        <Button
                          type="button"
                          disabled={
                            offerBusy ||
                            !Number(offerAmount) ||
                            (!selectedConversation?.booking && (!offerStartDate || !offerEndDate))
                          }
                          onClick={handleSendOffer}
                        >
                          {offerBusy ? "Sending..." : "Send Request"}
                        </Button>
                      </div>
                      {!selectedConversation?.booking ? (
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <label className="space-y-2 md:col-span-2">
                            <span className="text-xs font-extrabold text-black/70">Pricing unit</span>
                            <select
                              value={offerPricingUnit}
                              onChange={(event) => setOfferPricingUnit(event.target.value)}
                              className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-black/25 focus:ring-2 focus:ring-black/10"
                            >
                              <option value="daily">daily</option>
                              <option value="weekly">weekly</option>
                            </select>
                          </label>
                          <label className="space-y-2">
                            <span className="text-xs font-extrabold text-black/70">Offer start date</span>
                            <Input
                              type="date"
                              value={offerStartDate}
                              onChange={(event) => setOfferStartDate(event.target.value)}
                            />
                          </label>
                          <label className="space-y-2">
                            <span className="text-xs font-extrabold text-black/70">Offer end date</span>
                            <Input
                              type="date"
                              min={offerStartDate || undefined}
                              value={offerEndDate}
                              onChange={(event) => setOfferEndDate(event.target.value)}
                            />
                          </label>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <Textarea
                    value={composerText}
                    onChange={(event) => setComposerText(event.target.value)}
                    placeholder="Type your message"
                    className="min-h-[72px]"
                    maxLength={2000}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-black/45">
                      {composerText.trim().length}/2000
                    </div>
                    <Button type="submit" disabled={sending || !composerText.trim()}>
                      {sending ? "Sending..." : "Send message"}
                    </Button>
                  </div>
                </div>
              </form>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="text-xl font-extrabold text-black">Select a conversation</div>
              <p className="max-w-md text-sm font-semibold text-black/55">
                Choose a conversation from the left, or start one from a product or booking page.
              </p>
              <Button type="button" variant="secondary" onClick={() => navigate("/products")}>
                Browse Products
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
