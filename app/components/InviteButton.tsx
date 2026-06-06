"use client";

import { useMemo, useState } from "react";

export type Friend = {
  id: string;
  name: string;
  phone?: string;
};

export type InviteItem = {
  id: string;
  type: "phone" | "friend";
  label: string;
  value: string;
};

type InviteButtonProps = {
  friends?: Friend[];
  onInvitesChange?: (invites: InviteItem[]) => void;
};

const InviteButton = ({ friends = [], onInvitesChange }: InviteButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [invites, setInvites] = useState<InviteItem[]>([]);

  const hasFriends = friends.length > 0;

  const invitedFriendIds = useMemo(
    () =>
      new Set(
        invites.filter((i) => i.type === "friend").map((i) => i.id.replace("friend:", "")),
      ),
    [invites],
  );

  const addInvite = (item: InviteItem) => {
    setInvites((prev) => {
      const exists = prev.some((p) => p.id === item.id || p.value === item.value);
      if (exists) return prev;

      const next = [...prev, item];
      onInvitesChange?.(next);
      return next;
    });
  };

  const addPhoneNumber = () => {
    const value = phoneInput.trim();
    if (!value) return;

    addInvite({
      id: `phone:${value}`,
      type: "phone",
      label: value,
      value,
    });

    setPhoneInput("");
  };

  const addFriend = (friend: Friend) => {
    const value = friend.phone || friend.name;

    addInvite({
      id: `friend:${friend.id}`,
      type: "friend",
      label: friend.name,
      value,
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="h-12 rounded-full bg-slate-800 px-4 text-sm font-medium text-white flex items-center"
            title={invite.value}
          >
            {invite.label}
          </div>
        ))}

        {/* This + button stays visible, so after adding one invite you get "chip + new +" next to it */}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="h-12 w-12 rounded-full bg-slate-900 text-white text-2xl leading-none hover:bg-slate-700 transition"
          aria-label="Add invite"
        >
          +
        </button>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Invite</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Type a phone number</label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="+44 7000 000000"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                  />
                  <button
                    type="button"
                    onClick={addPhoneNumber}
                    className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
                  >
                    Add
                  </button>
                </div>
              </div>

              {hasFriends ? (
                <div>
                  <p className="block text-sm font-medium mb-2">Select from friends</p>
                  <div className="flex flex-wrap gap-2">
                    {friends
                      .filter((friend) => !invitedFriendIds.has(friend.id))
                      .map((friend) => (
                        <button
                          key={friend.id}
                          type="button"
                          onClick={() => addFriend(friend)}
                          className="rounded-full border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
                        >
                          {friend.name}
                        </button>
                      ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default InviteButton;