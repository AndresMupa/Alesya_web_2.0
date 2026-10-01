import { BookOpen, Bot, Boxes, Brain, CircuitBoard, Cpu, GraduationCap, Heart, Lightbulb, Microscope, PackageOpen, Printer, Puzzle, Rocket, School, ShieldCheck, Sparkles, Star, Trophy, UsersRound, Wrench, type LucideIcon } from "lucide-react";

/** Iconos que el equipo puede elegir en el editor de la portada. La clave se guarda en el documento; seguro para cliente y servidor. */
export const homeIcons: Record<string, { icon: LucideIcon; label: string }> = {
  bot: { icon: Bot, label: "Robot" },
  boxes: { icon: Boxes, label: "Bloques" },
  circuit: { icon: CircuitBoard, label: "Circuito" },
  cpu: { icon: Cpu, label: "Chip" },
  wrench: { icon: Wrench, label: "Herramienta" },
  printer: { icon: Printer, label: "Impresora 3D" },
  school: { icon: School, label: "Colegio" },
  graduation: { icon: GraduationCap, label: "Docentes" },
  users: { icon: UsersRound, label: "Familias" },
  sparkles: { icon: Sparkles, label: "Destellos" },
  shield: { icon: ShieldCheck, label: "Garantía" },
  book: { icon: BookOpen, label: "Libro" },
  rocket: { icon: Rocket, label: "Cohete" },
  lightbulb: { icon: Lightbulb, label: "Idea" },
  heart: { icon: Heart, label: "Corazón" },
  star: { icon: Star, label: "Estrella" },
  trophy: { icon: Trophy, label: "Trofeo" },
  puzzle: { icon: Puzzle, label: "Rompecabezas" },
  microscope: { icon: Microscope, label: "Microscopio" },
  brain: { icon: Brain, label: "Cerebro" },
  package: { icon: PackageOpen, label: "Kit" },
};

export const homeIconNames = Object.keys(homeIcons);

/** Icono por clave; si la clave ya no existe se usa uno neutro para no romper la portada. */
export const homeIcon = (name: string): LucideIcon => homeIcons[name]?.icon ?? Sparkles;
