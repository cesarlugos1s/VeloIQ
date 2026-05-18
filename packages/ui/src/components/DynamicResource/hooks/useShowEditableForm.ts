import { useMemo } from "react";
import { useForm } from "@refinedev/antd";
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

    useKeyboardShortcuts(useMemo(() => [
        { key: "s", ctrl: true, handler: () => (formProps as any)?.form?.submit() },
        { key: "Escape", handler: () => navigate(-1) },
    ], [(formProps as any)?.form, navigate]));

    return {
        formProps,
        saveButtonProps,
        queryResult: queryResult!,
        record,
        recordId,
    };
};
