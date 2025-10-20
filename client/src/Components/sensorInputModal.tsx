import { Modal, Form, Input} from "antd";
import { useState } from "react";
import axios from 'axios';

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
}


export default function SensorInputModal({open, onClose, onSubmit}: Props) {

    const [submitting, setSubmitting] = useState(false);
    const [form] = Form.useForm<SensorInputValues>();

    function handleSubmit() {
        try{
            setSubmitting(true);
            await axios.post('http://localhost:3000/api/sensors', {
                sensor_name: form.getFieldValue('name'),
                manufacturer: form.getFieldValue('manufacturer'),
                product_reference: form.getFieldValue('productref'),
                description: form.getFieldValue('description'),
                hw_version: form.getFieldValue('hwversion'),
                fw_version: form.getFieldValue('fwversion'),
                mounting_height_m: form.getFieldValue('mountingheight'),
                notes: form.getFieldValue('notes'),
            });
            onSubmit();
        }
        finally {
            setSubmitting(false);
        }
    }

    return(
        <Modal
            open={open}
            title={"Sensor Input"}
            onCancel={onClose}
            afterClose={() => form.resetFields()}
            okText="Submit"
            cancelText="Cancel"
            confirmLoading={submitting}
            okButtonProps={{ htmlType: "submit", form: FORM_ID, disabled: submitting }}
            maskClosable={!submitting}>

            <Form<SensorInputValues>
            form={form}
            id={FORM_ID}
            layout="vertical"
            onFinish={handleSubmit}
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

                <Form.Item
                    label="Product Reference"
                    name="productref"
                >
                    <Input />
                </Form.Item>

                <Form.Item
                    label="Description"
                    name="description"
                >
                    <Input.TextArea rows={3} />
                </Form.Item>

                <Form.Item
                    label="Mounting Height (m)"
                    name="mountingheight"
                    rules={[{ required: true, message: "Please enter the mounting height" }]}
                >
                    <Input type="number" step="0.01" />
                </Form.Item>

                <Form.Item
                    label="Hardware Version"
                    name="hwversion"
                >
                    <Input />
                </Form.Item>

                <Form.Item
                    label="Firmware Version"
                    name="fwversion"
                >
                    <Input />
                </Form.Item>

                <Form.Item
                    label="Notes"
                    name="notes"
                >
                    <Input.TextArea rows={3} />
                </Form.Item>

            </Form>

        </Modal>
    )
}