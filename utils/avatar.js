// Avatar utilities - placeholder colors and initials until real photos exist

const GRADIENTS = [
  ["#FF3C50", "#C0183B"],
  ["#FF6B35", "#C0441A"],
  ["#9B59B6", "#6C3483"],
  ["#2ECC71", "#1A8A4A"],
  ["#3498DB", "#1A5A8A"],
  ["#E91E8C", "#A01060"],
  ["#F39C12", "#B7770D"],
  ["#1ABC9C", "#0E8A72"],
];

export function getAvatarColors(name) {
  const index = (name?.charCodeAt(0) || 0) % GRADIENTS.length;
  return GRADIENTS[index];
}

export function getInitial(name) {
  return name?.[0]?.toUpperCase() || "?";
}
