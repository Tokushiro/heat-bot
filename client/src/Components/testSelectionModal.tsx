import React, { useCallback, useEffect, useState } from "react";
import { Modal, Form, Input,  Select, message, Spin } from "antd";
import type { FormInstance } from "antd";
import type { SelectProps } from "antd";
import SensorInputModal from "./sensorInputModal.tsx";
import TestChoiceInputModal from "./testChoiceImputModal.tsx";
import axios from "axios";
import type { Sensor } from "../Types/sensor.ts";
import type { TestChoice } from "../Types/testChoice.ts";
import type {Test} from "../Types/test.ts"
import { api } from "./apiAxios.ts";

type Props = {
    open: boolean;
    onClose: () => void;
    onSubmit: (values: Test, form: FormInstance<Test>) => Promise<void> | void;
    initialValues?: Partial<Test>;
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
    const [form] = Form.useForm<Test>();
    const [submitting, setSubmitting] = useState(false);

    const [sensorOptions, setSensorOptions] = useState<SelectProps["options"]>([]);
    const [choiceOptions, setChoiceOptions] = useState<SelectProps["options"]>([]);
    const [loadingOptions, setLoadingOptions] = useState(false);

    const [openSensor, setOpenSensor] = useState(false);
    const [openTestChoice, setOpenTestChoice] = useState(false);

    const fetchSensors = useCallback(async (signal?: AbortSignal) => {
        try {
            setLoadingOptions(true);
            const res = await api.get<Sensor[]>("/api/sensors", { signal });
            const opts: NonNullable<SelectProps["options"]> = res.data.map((s) => ({
                value: Number(s.sensor_id),
                label: s.sensor_name,
            }));
            setSensorOptions(opts);
        } catch (err: unknown) {
            if (axios.isCancel(err)) return;
            console.error("Error fetching sensors:", err);
            message.error("Failed to load sensors.");
        } finally {
            setLoadingOptions(false);
        }
    }, []);

    const fetchTests = useCallback(async (signal?: AbortSignal) => {
        try {
            setLoadingOptions(true);
            const res = await api.get<TestChoice[]>("/api/testchoice", { signal });
            const opts: NonNullable<SelectProps["options"]> = res.data.map((t) => ({
                value: Number(t.test_id),
                label: `${t.test_name} - ${t.test_standard} - ${t.test_method} - ${t.test_lab}`,
            }));
            setChoiceOptions(opts);
        } catch (err: unknown) {
            if (axios.isCancel(err)) return;
            // eslint-disable-next-line no-console
            console.error("Error fetching tests:", err);
            message.error("Failed to load tests.");
        } finally {
            setLoadingOptions(false);
        }
    }, []); // <-- removed stray baseURL dependency

    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();
        fetchSensors(controller.signal);
        fetchTests(controller.signal);
        return () => controller.abort();
    }, [open, fetchSensors, fetchTests]);

    const handleFinish = async (values: Test) => {
        try {
            setSubmitting(true);
            // ISO local (server expects 'YYYY-MM-DD HH:mm:ss' style)
            const time = new Date(
                Date.now() + 1000 * 60 * -(new Date().getTimezoneOffset())
            )
                .toISOString()
                .replace("T", " ")
                .replace("Z", "");

            const response = await api.post("/api/test", {
                test_name: values.test_name,
                test_choice: values.test_choice, // number
                sensor_id: values.sensor_id, // number
                test_date: time,
            });

            // Capture the test_id from the response
            const createdTest: Test = {
                ...values,
                test_id: response.data.test_id,
                test_date: new Date(time),
                status: 'PLANNED'
            };

            await onSubmit(createdTest, form);
            message.success("Test created");
            onClose();
            form.resetFields();
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(err);
            message.error("Failed to create test.");
        } finally {
            setSubmitting(false);
        }
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
            <TestChoiceInputModal
                open={openTestChoice}
                onClose={() => setOpenTestChoice(false)}
                onSubmit={async () => {
                    setOpenTestChoice(false);
                    await fetchTests();
                }}
            />

            <Modal
                open={open}
                title={title}
                onCancel={onClose}
                afterClose={() => form.resetFields()}
                okText="Submit"
                cancelText="Cancel"
                confirmLoading={submitting}
                okButtonProps={{ htmlType: "submit", form: FORM_ID, disabled: submitting }}
                maskClosable={!submitting}
            >
                <Form<Test>
                    id={FORM_ID}
                    form={form}
                    layout="vertical"
                    initialValues={initialValues}
                    onFinish={handleFinish}
                >
                    <Form.Item
                        label="Custom Test Name"
                        name="test_name"
                        rules={[{ required: true, message: "Please enter custom test name!" }]}
                    >
                        <Input placeholder="Enter custom test name" />
                    </Form.Item>

                    <Form.Item
                        label="Select Test"
                        name="test_choice"
                        rules={[{ required: true, message: "Please select one test" }]}
                    >
                        <Select
                            placeholder="Select test"
                            options={choiceOptions}
                            loading={loadingOptions}
                            notFoundContent={loadingOptions ? <Spin size="small" /> : null}
                            showSearch
                            optionFilterProp="label"
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
                                            onClick={() => setOpenTestChoice(true)}
                                            style={{ color: "#1677ff", fontWeight: 500, cursor: "pointer" }}
                                        >
                                            + Add new test details
                                        </a>
                                    </div>
                                </>
                            )}
                        />
                    </Form.Item>

                    <Form.Item
                        label="Select Sensor"
                        name="sensor_id"
                        rules={[{ required: true, message: "Please select at least one sensor!" }]}
                    >
                        <Select
                            placeholder="Select sensor"
                            options={sensorOptions}
                            loading={loadingOptions}
                            notFoundContent={loadingOptions ? <Spin size="small" /> : null}
                            showSearch
                            optionFilterProp="label"
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
