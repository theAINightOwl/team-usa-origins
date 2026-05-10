import React from "react";

/*
 * AtlasAvatar — the friendly face used wherever Atlas speaks.
 * Shared between the floating launcher, the embedded chat header, the
 * reopen button on the app shell, and the agent message bubbles.
 *
 * Renders the illustrated portrait at /atlas.png inside a circular frame,
 * so the same image works at any size (16–64px).
 */
export default function AtlasAvatar({ size = 28, className = "", title }) {
  return (
    <span
      className={`atlas-avatar ${className}`}
      style={{ width: size, height: size }}
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
    >
      <img
        src="/atlas.svg"
        alt=""
        width={size}
        height={size}
        draggable={false}
      />
    </span>
  );
}
