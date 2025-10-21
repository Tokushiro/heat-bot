import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Form, Input, Radio, Select, message, Spin, Typography } from "antd";
import type { FormInstance } from "antd";
import type { SelectProps } from "antd";
import SensorInputModal from "./sensorInputModal.tsx";
import axios from "axios";
import type { Sensor } from "../Types/sensor.ts";

export type TestSelectionValues = {
    testType: "testPattern1" | "testPattern2";
    customTestName: string;
    sensors: number;
};

type Props = {
    open: boolean;
    onClose: () => void;
    onSubmit: (values: TestSelectionValues, form: FormInstance<TestSelectionValues>) => Promise<void> | void;
    initialValues?: Partial<TestSelectionValues>;
    title?: React.ReactNode;
};

const FORM_ID = "test-selection-modal-form";

export default function TestSelectionModal({
                                               open,
                                               onClose,
                                               onSubmit,
                                               initialValues,
                                               title = "Select & Configure Test",
                                           }: Props) {
    const [form] = Form.useForm<TestSelectionValues>();
    const [submitting, setSubmitting] = useState(false);

    const [options, setOptions] = useState<SelectProps["options"]>([]);
    const [loadingOptions, setLoadingOptions] = useState(false);

    const [openSensor, setOpenSensor] = useState(false);

    const baseURL = useMemo(() => "http://localhost:3000", []);

    const fetchSensors = useCallback(async (signal?: AbortSignal) => {
        try {
            setLoadingOptions(true);
            const res = await axios.get<Sensor[]>(`${baseURL}/api/sensors`, { signal });
            const opts: NonNullable<SelectProps["options"]> = res.data.map((s) => ({
                value: String(s.sensor_id),
                label: s.sensor_name,
            }));
            setOptions(opts);
        } catch (err: unknown) {
            if (axios.isCancel(err)) return;
            console.error("Error fetching sensors:", err);
            message.error("Failed to load sensors.");
        } finally {
            setLoadingOptions(false);
        }
    }, [baseURL]);

    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();
        fetchSensors(controller.signal);
        return () => controller.abort();
    }, [open, fetchSensors]);

    const handleFinish = async (values: TestSelectionValues) => {
        try {
            setSubmitting(true);
            await onSubmit(values, form);
        } finally {
            setSubmitting(false);
        }
    };

    const handleAfterClose = () => {
        form.resetFields();
    };

    return (
        <>
            <SensorInputModal
                open={openSensor}
                onClose={() => setOpenSensor(false)}
                onSubmit={async () => {
                    setOpenSensor(false);
                    await fetchSensors();
                }}
            />

            <Modal
                open={open}
                title={title}
                onCancel={onClose}
                afterClose={handleAfterClose}
                okText="Submit"
                cancelText="Cancel"
                confirmLoading={submitting}
                okButtonProps={{ htmlType: "submit", form: FORM_ID, disabled: submitting }}
                maskClosable={!submitting}
            >
                <Form<TestSelectionValues>
                    id={FORM_ID}
                    form={form}
                    layout="vertical"
                    initialValues={initialValues}
                    onFinish={handleFinish}
                >
                    <Form.Item
                        label="Select Test Type"
                        name="testType"
                        rules={[{ required: true, message: "Please select a test type!" }]}
                    >
                        <Radio.Group>
                            <Radio value="testPattern1">Test Pattern 1</Radio>
                            <Radio value="testPattern2">Test Pattern 2</Radio>
                        </Radio.Group>
                    </Form.Item>

                    <Form.Item
                        label="Custom Test Name"
                        name="customTestName"
                        rules={[{ required: true, message: "Please enter custom test name!" }]}
                    >
                        <Input placeholder="Enter custom test name" />
                    </Form.Item>

                    <Form.Item
                        label="Select Sensor"
                        name="sensors"
                        rules={[{ required: true, message: "Please select at least one sensor!" }]}
                    >
                        <Select
                            placeholder="Select sensors to include"
                            options={options}
                            loading={loadingOptions}
                            notFoundContent={loadingOptions ? <Spin size="small" /> : null}
                            dropdownRender={(menu) => (
                                <>
                                    {menu}
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "center",
                                            padding: 8,
                                            borderTop: "1px solid #f0f0f0",
                                        }}
                                    >
                                        <a
                                            onClick={() => setOpenSensor(true)}
                                            style={{ color: "#1677ff", fontWeight: 500, cursor: "pointer" }}
                                        >
                                            + Add new sensor
                                        </a>
                                    </div>
                                </>
                            )}
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
}
