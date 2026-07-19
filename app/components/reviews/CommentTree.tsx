"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { Avatar, Button, useToast } from "@/app/components/ui";
import { safeImageSrc } from "@/lib/url";
import { deleteComment } from "@/lib/reviews/actions";
import { CommentForm } from "./CommentForm";
import { FlagDialog } from "./FlagDialog";
import type { CommentRow } from "@/lib/reviews/queries";

const PAGE_SIZE = 10;

type CommentNode = CommentRow & { children: CommentNode[] };

/**
 * Facebook-style threaded comments. The owner-ED reply floats to the
 * top (spec: "always shown at the top") and gets a distinct amber
 * treatment; every other comment shows in creation order. Replies
 * indent + get a left rule so the thread is scannable. Paginates when
 * the top-level count exceeds 10.
 */
export function CommentTree({
  reviewId,
  comments,
  currentUserId,
  isAdmin,
  bannedWords,
}: {
  reviewId: string;
  comments: CommentRow[];
  currentUserId: string | null;
  isAdmin: boolean;
  bannedWords: string[];
}) {
  const { tops, orphaned } = useMemo(() => buildTree(comments), [comments]);
  const [page, setPage] = useState(0);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [flagging, setFlagging] = useState<string | null>(null);
  const { push } = useToast();

  const totalPages = Math.max(1, Math.ceil(tops.length / PAGE_SIZE));
  const shown = tops.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <CommentForm
        reviewId={reviewId}
        bannedWords={bannedWords}
        placeholder="Write a comment…"
        submitLabel="Post comment"
      />
      {shown.map((c) => (
        <CommentNodeView
          key={c.id}
          node={c}
          reviewId={reviewId}
          depth={0}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          bannedWords={bannedWords}
          replyingTo={replyingTo}
          editing={editing}
          onReply={setReplyingTo}
          onEdit={setEditing}
          onFlag={setFlagging}
          onDelete={async (id) => {
            const res = await deleteComment(id);
            if (res.error) push("error", res.error);
            else push("success", "Comment removed.");
          }}
        />
      ))}
      {orphaned.length > 0 && (
        <p className="text-xs text-slate-400">
          {orphaned.length} orphaned{" "}
          {orphaned.length === 1 ? "comment" : "comments"} (parent removed).
        </p>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-2 text-xs text-slate-500">
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Prev
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </Button>
          </div>
        </div>
      )}
      {flagging && (
        <FlagDialog
          open
          contentType="comment"
          contentId={flagging}
          onClose={() => setFlagging(null)}
          onFlagged={() => setFlagging(null)}
        />
      )}
    </div>
  );
}

function CommentNodeView({
  node,
  reviewId,
  depth,
  currentUserId,
  isAdmin,
  bannedWords,
  replyingTo,
  editing,
  onReply,
  onEdit,
  onFlag,
  onDelete,
}: {
  node: CommentNode;
  reviewId: string;
  depth: number;
  currentUserId: string | null;
  isAdmin: boolean;
  bannedWords: string[];
  replyingTo: string | null;
  editing: string | null;
  onReply: (id: string | null) => void;
  onEdit: (id: string | null) => void;
  onFlag: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isOwn = currentUserId && node.author_id === currentUserId;
  const canModerate = isAdmin;
  const isReply = depth > 0;
  const isOwnerReply = node.is_owner_reply;
  const org = node.author?.organization_title ?? null;
  const displayName = isOwnerReply && org
    ? org
    : [node.author?.first_name, node.author?.last_name]
        .filter(Boolean)
        .join(" ") || "Former member";
  const avatarSrc = isOwnerReply
    ? safeImageSrc(node.author?.org_logo_url)
    : safeImageSrc(node.author?.profile_photo_url);
  // Identity links to the author's public page by type; anonymized
  // comments (author gone) and admins have none.
  const authorHref =
    !node.anonymized && node.author_id && node.author
      ? node.author.user_type === "event_director"
        ? `/directors/${node.author_id}`
        : node.author.user_type === "attendee"
          ? `/attendees/${node.author_id}`
          : null
      : null;

  return (
    <div
      className={`${isReply ? "ml-8 border-l-2 border-slate-100 pl-4" : ""}`}
    >
      <article
        className={`rounded-xl border p-4 ${
          isOwnerReply
            ? "border-amber-300 bg-amber-50/60"
            : "border-slate-200 bg-white"
        }`}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {authorHref ? (
              <a href={authorHref} className="shrink-0">
                <Avatar src={avatarSrc} name={displayName} size={32} />
              </a>
            ) : (
              <Avatar src={avatarSrc} name={displayName} size={32} />
            )}
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-slate-900">
                {authorHref ? (
                  <a
                    href={authorHref}
                    className="text-slate-900 no-underline hover:underline"
                  >
                    {displayName}
                  </a>
                ) : (
                  displayName
                )}
                {isOwnerReply && (
                  <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                    Event Director
                  </span>
                )}
              </p>
              <p className="text-[11px] text-slate-500">
                {formatDate(node.created_at)}
                {node.updated_at !== node.created_at && " · edited"}
              </p>
            </div>
          </div>
        </header>

        {editing === node.id ? (
          <div className="mt-3">
            <CommentForm
              reviewId={reviewId}
              commentId={node.id}
              initialBody={node.body}
              bannedWords={bannedWords}
              submitLabel="Save"
              onDone={() => onEdit(null)}
            />
          </div>
        ) : (
          <p className="mt-3 whitespace-pre-line text-sm text-slate-800">
            {node.body}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] font-semibold text-slate-500">
          {currentUserId && !isOwnerReply && (
            <button
              type="button"
              onClick={() =>
                onReply(replyingTo === node.id ? null : node.id)
              }
              className="hover:text-slate-800"
            >
              Reply
            </button>
          )}
          {isOwn && (
            <>
              <button
                type="button"
                onClick={() =>
                  onEdit(editing === node.id ? null : node.id)
                }
                className="hover:text-slate-800"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(node.id)}
                className="hover:text-red-600"
              >
                Delete
              </button>
            </>
          )}
          {!isOwn && currentUserId && (
            <button
              type="button"
              onClick={() => onFlag(node.id)}
              className="hover:text-red-600"
            >
              Flag
            </button>
          )}
          {canModerate && !isOwn && (
            <button
              type="button"
              onClick={() => onDelete(node.id)}
              className="hover:text-red-600"
            >
              Delete (admin)
            </button>
          )}
          {isOwnerReply && node.author?.organization_title && node.author_id && (
            <Link
              href={`/directors/${node.author_id}` as Route}
              className="hover:text-slate-800"
            >
              View director
            </Link>
          )}
        </div>
      </article>

      {replyingTo === node.id && (
        <div className={`ml-8 mt-3 border-l-2 border-slate-100 pl-4`}>
          <CommentForm
            reviewId={reviewId}
            parentCommentId={node.id}
            bannedWords={bannedWords}
            placeholder={`Reply to ${displayName}…`}
            submitLabel="Post reply"
            onDone={() => onReply(null)}
          />
        </div>
      )}

      {node.children.length > 0 && (
        <div className="mt-3 space-y-3">
          {node.children.map((child) => (
            <CommentNodeView
              key={child.id}
              node={child}
              reviewId={reviewId}
              depth={depth + 1}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              bannedWords={bannedWords}
              replyingTo={replyingTo}
              editing={editing}
              onReply={onReply}
              onEdit={onEdit}
              onFlag={onFlag}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Build a top-level thread order: owner replies first (pinned),
 * then newest-first top-level, each with descendant replies attached
 * in creation order.
 */
function buildTree(comments: CommentRow[]): {
  tops: CommentNode[];
  orphaned: CommentRow[];
} {
  const byId = new Map<string, CommentNode>();
  for (const c of comments) byId.set(c.id, { ...c, children: [] });
  const tops: CommentNode[] = [];
  const orphaned: CommentRow[] = [];
  for (const c of comments) {
    const node = byId.get(c.id)!;
    if (c.parent_comment_id) {
      const parent = byId.get(c.parent_comment_id);
      if (parent) parent.children.push(node);
      else orphaned.push(c);
    } else {
      tops.push(node);
    }
  }
  tops.sort((a, b) => {
    if (a.is_owner_reply && !b.is_owner_reply) return -1;
    if (!a.is_owner_reply && b.is_owner_reply) return 1;
    return b.created_at.localeCompare(a.created_at);
  });
  return { tops, orphaned };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
