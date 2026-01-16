import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldCheck, Send, User } from "lucide-react";

/**
 * CommentModal — a child‑friendly, pink→violet styled modal comment section.
 *
 * Props:
 *  - isOpen: boolean — controls modal visibility
 *  - onClose: () => void — called when modal is dismissed
 *  - currentUserId?: string — signed-in user's id (for highlighting their own comments)
 *  - creatorUserId?: string — the creator/owner's id to badge their comments
 *  - initialComments?: Array<{ id: string; userId: string; displayName: string; text: string; createdAt: number }>
 *  - onSubmitComment?: (commentText: string) => Promise<void> | void — optional hook you can use to write to Firebase
 *  - bannedWords?: string[] — optional override list of banned words
 *
 * Notes:
 *  - By default, the component enforces: no links, no images, profanity filter.
 *  - When a violation is detected, it shows a child‑friendly popup and blocks the post.
 *  - You can wire Firebase Realtime Database in onSubmitComment; see TODO at bottom.
 */
export default function CommentModal({
  isOpen,
  onClose,
  currentUserId,
  creatorUserId,
  patternId,
  onSubmitComment,
  bannedWords,
}) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [alert, setAlert] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const listRef = useRef(null);

  // Load comments when modal opens
  useEffect(() => {
    if (isOpen && patternId) {
      const loadComments = async () => {
        try {
          console.log('CommentModal: Loading comments for pattern:', patternId);
          // Import firebase here to avoid circular dependencies
          const firebase = (await import('firebase/compat/app')).default;
          const db = firebase.database();
          const commentsRef = db.ref(`comments/${patternId}`);
          const snapshot = await commentsRef.once('value');
          console.log('CommentModal: Comments snapshot exists:', snapshot.exists());
          if (snapshot.exists()) {
            const commentsData = snapshot.val();
            console.log('CommentModal: Comments data:', commentsData);
            const commentsArray = Object.keys(commentsData).map(key => ({
              id: key,
              ...commentsData[key]
            })).sort((a, b) => a.createdAt - b.createdAt);
            
            // Fetch usernames for each comment
            const commentsWithUsernames = await Promise.all(
              commentsArray.map(async (comment) => {
                try {
                  const userSnap = await db.ref(`users/${comment.userId}`).once('value');
                  const userData = userSnap.val();
                  return {
                    ...comment,
                    username: userData?.username || comment.displayName || "Unknown"
                  };
                } catch (error) {
                  console.warn('Error fetching username for comment:', comment.id, error);
                  return {
                    ...comment,
                    username: comment.displayName || "Unknown"
                  };
                }
              })
            );
            
            console.log('CommentModal: Loaded comments with usernames:', commentsWithUsernames);
            setComments(commentsWithUsernames);
          } else {
            console.log('CommentModal: No comments found');
            setComments([]);
          }
        } catch (error) {
          console.error('CommentModal: Error loading comments:', error);
          setComments([]);
        }
      };
      loadComments();
    } else {
      setComments([]);
    }
  }, [isOpen, patternId]);

  // Default child‑friendly banned words list. Expand as needed.
  const defaultBanned = useMemo(
    () =>
      [
        // common profanity — keep this list short and extend in your app
        "shit",
        "fuck",
        "bitch",
        "asshole",
        "bastard",
        "dick",
        "piss",
        "crap",
        "damn",
        "hell",
        "slut",
        "whore",
      ],
    []
  );

  const banned = useMemo(() => (bannedWords && bannedWords.length ? bannedWords : defaultBanned), [bannedWords, defaultBanned]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    // autoscroll to bottom when comments change
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments, isOpen]);

  const hasLinkOrImage = (s) => {
    const linkPattern = /(https?:\/\/|www\.)/i;
    const markdownImg = /!\[[^\]]*\]\([^\)]*\)/i; // ![alt](url)
    const htmlImg = /<\s*img\b[^>]*>/i;
    return linkPattern.test(s) || markdownImg.test(s) || htmlImg.test(s);
  };

  const usesBannedWord = (s) => {
    const cleaned = s.toLowerCase();
    return banned.some((w) =>
      new RegExp(`(^|[^a-z])${escapeRegExp(w)}([^a-z]|$)`, "i").test(cleaned)
    );
  };

  const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    // Guardrails
    if (hasLinkOrImage(trimmed)) {
      setAlert("Links and images aren't allowed. Please keep comments text‑only.");
      return;
    }
    if (usesBannedWord(trimmed)) {
      setAlert("Certain banned words used. Post removed.");
      setText("");
      return;
    }

    try {
      setSubmitting(true);

      if (onSubmitComment) {
        await onSubmitComment(trimmed);
        // Reload comments after successful submission
        if (isOpen && patternId) {
          const firebase = (await import('firebase/compat/app')).default;
          const db = firebase.database();
          const commentsRef = db.ref(`comments/${patternId}`);
          const snapshot = await commentsRef.once('value');
          if (snapshot.exists()) {
            const commentsData = snapshot.val();
            const commentsArray = Object.keys(commentsData).map(key => ({
              id: key,
              ...commentsData[key]
            })).sort((a, b) => a.createdAt - b.createdAt);
            setComments(commentsArray);
          }
        }
      }
      
      setText("");
    } catch (err) {
      // Show error
      setAlert("Sorry, we couldn't save your comment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-xl overflow-hidden rounded-2xl shadow-2xl"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
          >
            {/* Header gradient */}
            <div className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 p-5 text-white">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">Comments (kid‑friendly)</h2>
                </div>
                <button
                  aria-label="Close comments"
                  onClick={onClose}
                  className="rounded-full p-1.5 transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-1 text-xs/relaxed text-white/90">
                No links, no images, be kind.
              </p>
            </div>

            {/* Body */}
            <div className="bg-white p-4 dark:bg-zinc-900">
              {/* List */}
              <div
                ref={listRef}
                className="max-h-80 space-y-3 overflow-y-auto pr-1"
              >
                {comments.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-violet-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    No comments yet. Be the first to say hi!
                  </div>
                ) : (
                  comments.map((c) => {
                    const isCreator = creatorUserId && c.userId === creatorUserId;
                    const isMe = currentUserId && c.userId === currentUserId;
                    return (
                      <div
                        key={c.id}
                        className={`rounded-2xl border p-3 shadow-sm ${
                          isCreator
                            ? "border-pink-200 bg-pink-50 dark:border-pink-900/40 dark:bg-pink-950/30"
                            : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-violet-600 text-white shadow">
                              <User className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                {c.username}
                              </span>
                              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                {new Date(c.createdAt).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isCreator && (
                              <span className="rounded-full bg-gradient-to-r from-pink-500 to-violet-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
                                Creator
                              </span>
                            )}
                            {isMe && !isCreator && (
                              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                You
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-800 dark:text-zinc-100">
                          {c.text}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Composer */}
              <form onSubmit={handleSubmit} className="mt-4">
                <div className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm focus-within:ring-2 focus-within:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, 400))}
                    placeholder="Write a kind, text‑only comment (max 400 chars)…"
                    className="h-24 w-full resize-none rounded-xl p-3 text-sm outline-none placeholder:text-zinc-400 bg-white text-black"
                  />
                  <div className="flex items-center justify-between px-2 pb-1">
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {400 - text.length} characters left
                    </span>
                    <button
                      type="submit"
                      disabled={submitting || !text.trim()}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" /> Post
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </motion.div>

          {/* Alert popup */}
          <AnimatePresence>
            {alert && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="fixed bottom-6 left-1/2 z-[110] w-[92%] max-w-md -translate-x-1/2 rounded-2xl border border-pink-200 bg-white p-4 text-sm text-zinc-800 shadow-xl dark:border-pink-900/40 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-violet-600 text-white">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Safety Check</p>
                    <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300">{alert}</p>
                  </div>
                  <button
                    onClick={() => setAlert(null)}
                    className="rounded-full p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800"
                    aria-label="Dismiss"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/*
  ===== Firebase RTDB wiring (optional) =====

  Example usage in your app:

  const [open, setOpen] = useState(false);

  <CommentModal
    isOpen={open}
    onClose={() => setOpen(false)}
    currentUserId={user?.uid}
    creatorUserId={creatorId}
    initialComments={commentsFromDb}
    onSubmitComment={async (text) => {
      // Write to RTDB under comments/{postId}/{pushId}
      import { getDatabase, ref, push, serverTimestamp, set } from "firebase/database";
      const db = getDatabase();
      const newRef = push(ref(db, `comments/${postId}`));
      await set(newRef, {
        userId: user?.uid,
        displayName: user?.displayName || "Anon",
        text,
        createdAt: Date.now(), // or serverTimestamp()
      });
    }}
  />

  And to live‑subscribe (outside the component), use onValue on comments/{postId} and pass the array as initialComments (or fork this component to manage the subscription internally).
*/