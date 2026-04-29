"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ChevronDownIcon from "@heroicons/react/24/outline/ChevronDownIcon";
import {
  Box,
  ButtonBase,
  Chip,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import type { ModelOut } from "@/lib/types/api";

type ModelWorkspaceNavProps = {
  modelId: string;
  models: ModelOut[];
};

const NAV_ITEMS = [
  { href: "", label: "Resumen" },
  { href: "/board", label: "Board" },
  { href: "/library", label: "Biblioteca" },
  { href: "/outputs", label: "Outputs" },
  { href: "/dependencies", label: "Dependencias" },
];

export default function ModelWorkspaceNav({
  modelId,
  models,
}: ModelWorkspaceNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const currentModel = models.find((model) => model.id === modelId);
  const basePrefix = `/models/${modelId}`;
  const sectionSuffix = pathname.startsWith(basePrefix)
    ? pathname.slice(basePrefix.length)
    : "";

  return (
    <nav
      className="panel-surface sticky top-0 z-40 py-3 sm:px-5 w-[100%] rounded-b-xl"
      aria-label="Navegacion del modelo"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className=" px-3 py-2">
            <Image
              src="/brand/logo-impx2.png"
              alt="ImProgress"
              width={132}
              height={29}
              priority
            />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-[var(--heading)]">
                {currentModel?.name || "Modelo"}
              </p>
              {currentModel ? (
                <Chip
                  label={currentModel.frequency}
                  size="small"
                  sx={{
                    backgroundColor: "rgba(0, 56, 101, 0.08)",
                    color: "var(--accent)",
                    fontWeight: 700,
                    borderRadius: "10px",
                  }}
                />
              ) : null}
            </div>
            {currentModel ? (
              <p className="truncate text-xs text-[var(--foreground-muted)]">
                H {currentModel.actuals_end_period_key || "sin definir"} | P{" "}
                {currentModel.forecast_end_period_key || "sin definir"}
              </p>
            ) : null}
          </div>

          <ButtonBase
            aria-label="Cambiar modelo"
            onClick={(event) => setMenuAnchor(event.currentTarget)}
            sx={{
              border: "1px solid var(--border)",
              borderRadius: "14px",
              px: 1.5,
              py: 1,
              color: "var(--accent)",
              gap: 0.75,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            <span className="text-sm">Cambiar</span>
            <ChevronDownIcon className="h-4 w-4" />
          </ButtonBase>

          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
            slotProps={{
              paper: {
                sx: {
                  mt: 1,
                  minWidth: 280,
                  borderRadius: 2,
                  border: "1px solid var(--border)",
                  boxShadow: "0 16px 36px rgba(21,21,21,0.08)",
                },
              },
            }}
          >
            {models.map((model) => (
              <MenuItem
                key={model.id}
                selected={model.id === modelId}
                onClick={() => {
                  setMenuAnchor(null);
                  router.push(`/models/${model.id}${sectionSuffix}`);
                }}
              >
                <Stack spacing={0.25}>
                  <Typography sx={{ fontWeight: 600 }}>{model.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {model.frequency} | H{" "}
                    {model.actuals_end_period_key || "sin definir"} | P{" "}
                    {model.forecast_end_period_key || "sin definir"}
                  </Typography>
                </Stack>
              </MenuItem>
            ))}
          </Menu>
        </div>

        <Box
          component="ul"
          aria-label="Secciones del modelo"
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 1.25,
            listStyle: "none",
            m: 0,
            p: 0,
          }}
        >
          {NAV_ITEMS.map((item) => {
            const target = `/models/${modelId}${item.href}`;
            const isActive = pathname === target;

            return (
              <li key={target}>
                <Link
                  href={target}
                  aria-current={isActive ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-[14px] border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] ${
                    isActive
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_12px_24px_rgba(0,56,101,0.16)]"
                      : "border-[var(--border)] bg-white text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  }`}
                  style={isActive ? { color: "#ffffff" } : undefined}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </Box>
      </div>
    </nav>
  );
}
