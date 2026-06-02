export type Availability = "yes" | "no" | "maybe";

export type TeamEvent = {
  id: string;
  title: string;
  dateLabel: string;
  location: string;
  type: "Practice" | "Game" | "Meeting";
  availability: Record<string, Availability>;
};

export type TeamMember = {
  id: string;
  name: string;
  role: "Player" | "Coach" | "Manager";
  position?: string;
};

export type TeamMessage = {
  id: string;
  sender: string;
  title: string;
  body: string;
  pinned: boolean;
  unread: boolean;
};

export type TeamFile = {
  id: string;
  name: string;
  type: "Picture" | "File";
};
