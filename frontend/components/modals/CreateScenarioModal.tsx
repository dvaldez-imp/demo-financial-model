"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { NewScenarioFormValues } from "@/lib/types/board";

type CreateScenarioModalProps = {
  open: boolean;
  pending?: boolean;
  onClose: () => void;
  onSubmit: (values: NewScenarioFormValues) => Promise<void> | void;
};

const INITIAL_VALUES: NewScenarioFormValues = {
  name: "",
  description: "",
};

export default function CreateScenarioModal({
  open,
  pending = false,
  onClose,
  onSubmit,
}: CreateScenarioModalProps) {
  const [values, setValues] = useState(INITIAL_VALUES);

  function handleClose() {
    setValues(INITIAL_VALUES);
    onClose();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      name: values.name.trim(),
      description: values.description.trim(),
    });
    setValues(INITIAL_VALUES);
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Crear escenario"
      description="Un escenario altera la prediccion de algunas premisas sin duplicar todo el modelo."
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input
          label="Nombre"
          placeholder="Inflacion alta"
          value={values.name}
          onChange={(event) =>
            setValues((current) => ({ ...current, name: event.target.value }))
          }
          required
        />
        <Input
          label="Descripcion"
          placeholder="Escenario con presion inflacionaria y costos mas altos"
          value={values.description}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
        />

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending || values.name.trim().length === 0}>
            Crear escenario
          </Button>
        </div>
      </form>
    </Modal>
  );
}
