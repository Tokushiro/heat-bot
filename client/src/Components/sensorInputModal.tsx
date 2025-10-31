import { Modal, Form, Input, message } from "antd";
import { useState } from "react";
import { api } from "./apiAxios.ts";

export type SensorInputValues = {
    sensorid: number | null;
    name: string;
    manufacturer: string;
    productref: string;
    description: string | null;
    hwversion: string | null;
    fwversion: string | null;
    mountingheight: number;
    notes: string | null;
};

const FORM_ID = "sensor-input-modal-form";

type Props = {
    open: boolean;
    onClose: () => void;
    onSubmit: () => void;
};

export default function SensorInputModal({ open, onClose, onSubmit }: Props) {
    const [submitting, setSubmitting] = useState(false);
    const [form] = Form.useForm<SensorInputValues>();

    const handleSubmit = async (values: SensorInputValues) => {
        try {
            setSubmitting(true);

            const mountingHeightNum =
                typeof values.mountingheight === "string"
                    ? parseFloat(values.mountingheight)
                    : values.mountingheight;


            await api.post("/api/sensors", {
                sensor_name: values.name,
                manufacturer: values.manufacturer,
                product_reference: values.productref || null,
                description: values.description || null,
                hw_version: values.hwversion || null,
                fw_version: values.fwversion || null,
                mounting_height_m: mountingHeightNum,
                notes: values.notes || null,
            });

            message.success("Sensor added successfully");
            onSubmit();
            onClose();
            form.resetFields();
        } catch (err: any) {
            console.error(err);
            message.error(
                err?.response?.data?.message ?? "Failed to add sensor. Please try again."
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            open={open}
            title="Sensor Input"
            onCancel={onClose}
            afterClose={() => form.resetFields()}
            okText="Submit"
            cancelText="Cancel"
            confirmLoading={submitting}
            okButtonProps={{ htmlType: "submit", form: FORM_ID, disabled: submitting }}
            maskClosable={!submitting}
        >
            <Form<SensorInputValues>
                form={form}
                id={FORM_ID}
                layout="vertical"
                onFinish={handleSubmit}
                initialValues={{
                    sensorid: null,
                    name: "",
                    manufacturer: "",
                    productref: "",
                    description: null,
                    hwversion: null,
                    fwversion: null,
                    mountingheight: 0,
                    notes: null,
                }}
            >
                <Form.Item
                    label="Sensor Name"
                    name="name"
                    rules={[{ required: true, message: "Please enter the sensor name" }]}
                >
                    <Input />
                </Form.Item>

                <Form.Item
                    label="Manufacturer"
                    name="manufacturer"
                    rules={[{ required: true, message: "Please enter the manufacturer" }]}
                >
                    <Input />
                </Form.Item>

                <Form.Item label="Product Reference" name="productref">
                    <Input />
                </Form.Item>

                <Form.Item label="Description" name="description">
                    <Input.TextArea rows={3} />
                </Form.Item>

                <Form.Item
                    label="Mounting Height (m)"
                    name="mountingheight"
                    rules={[
                        { required: true, message: "Please enter the mounting height" },
                        {
                            validator: (_, value) =>
                                value === null || value === undefined || value === ""
                                    ? Promise.reject("Please enter the mounting height")
                                    : isNaN(Number(value))
                                        ? Promise.reject("Mounting height must be a number")
                                        : Promise.resolve(),
                        },
                    ]}
                >
                    <Input type="number" step="0.01" />
                </Form.Item>

                <Form.Item label="Hardware Version" name="hwversion">
                    <Input />
                </Form.Item>

                <Form.Item label="Firmware Version" name="fwversion">
                    <Input />
                </Form.Item>

                <Form.Item label="Notes" name="notes">
                    <Input.TextArea rows={3} />
                </Form.Item>
            </Form>
        </Modal>
    );
}
