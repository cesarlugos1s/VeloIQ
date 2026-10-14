import { useMemo } from "react";
import { useForm } from "@refinedev/antd";
import { useCan } from "@refinedev/core";
import { useNavigate } from "react-router-dom";
import { useKeyboardShortcuts } from "../../../hooks/useKeyboardShortcuts";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export const useShowEditableForm = (
    resource: string,
    id?: string | number,
) => {
    const navigate = useNavigate();
    const { formProps, saveButtonProps, queryResult } = useForm({
        resource,
        action: "edit",
        id,
        redirect: false,
        successNotification: () => ({
            message: _("Changes saved."),
            type: "success",
        }),
    });
    const record = queryResult?.data?.data;
    const recordId = record?.eid ?? record?.id ?? id;
    // Inline editing on the show page needs Update (AC-E2): without it the
    // form is read-only and its save button disabled.
    const { data: canEditData } = useCan({ resource, action: "edit" });
    const canEdit = canEditData?.can !== false;

    useKeyboardShortcuts(useMemo(() => [
        { key: "s", ctrl: true, handler: () => { if (canEdit) (formProps as any)?.form?.submit(); } },
        { key: "Escape", handler: () => navigate(-1) },
    ], [(formProps as any)?.form, navigate, canEdit]));

    return {
        formProps: canEdit ? formProps : { ...formProps, disabled: true },
        saveButtonProps: canEdit ? saveButtonProps : { ...saveButtonProps, disabled: true },
        queryResult: queryResult!,
        record,
        recordId,
    };
};
