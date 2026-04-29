import {
  Factory,
  LayoutGrid,
  LineChart,
  Settings,
  Truck,
} from "lucide-react";

export const navItems = [
  { label: "Overview", icon: LayoutGrid, href: "/" },
  { label: "Suppliers", icon: Factory, href: "/suppliers" },
  { label: "Logistics", icon: Truck, href: "/logistics" },
  { label: "Analytics", icon: LineChart, href: "/analytics" },
  { label: "Settings", icon: Settings, href: "/settings" },
];
