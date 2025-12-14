import React, { useState } from 'react';
import { Modal, Form, InputNumber, Select, Alert } from 'antd';

interface InitialPositionDialogProps {
    visible: boolean;
    onConfirm: (position: InitialPosition) => void;
    onCancel: () => void;
}

export interface InitialPosition {
    distanceFromSensor: number;  // meters
    facingAngle: number;          // degrees (0° = North, 90° = East, etc.)
    robotOrientation: 'tangential' | 'radial';
}

export const InitialPositionDialog: React.FC<InitialPositionDialogProps> = ({
    visible,
    onConfirm,
    onCancel
}) => {
    const [form] = Form.useForm();
    const [orientation, setOrientation] = useState<'tangential' | 'radial'>('tangential');

    const handleOk = () => {
        form.validateFields().then(values => {
            onConfirm({
                distanceFromSensor: values.distance,
                facingAngle: values.angle,
                robotOrientation: values.orientation
            });
            form.resetFields();
        });
    };

    return (
        <Modal
            title="Initial Robot Position Setup"
            open={visible}
            onOk={handleOk}
            onCancel={onCancel}
            width={600}
        >
            <Alert
                message="Position Reference System"
                description="The sensor is at position (0, 0). Please enter the robot's starting position relative to the sensor."
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
            />

            <Form
                form={form}
                layout="vertical"
                initialValues={{
                    distance: 2.0,
                    angle: 0,
                    orientation: 'tangential'
                }}
            >
                <Form.Item
                    label="Distance from Sensor"
                    name="distance"
                    rules={[{ required: true, message: 'Please enter distance' }]}
                    extra="How far is the robot from the sensor (in meters)?"
                >
                    <InputNumber
                        min={0.5}
                        max={10}
                        step={0.1}
                        style={{ width: '100%' }}
                        addonAfter="meters"
                    />
                </Form.Item>

                <Form.Item
                    label="Facing Direction"
                    name="angle"
                    rules={[{ required: true, message: 'Please enter angle' }]}
                    extra="Which direction is the robot facing? (0° = North, 90° = East, 180° = South, 270° = West)"
                >
                    <Select
                        style={{ width: '100%' }}
                        options={[
                            { value: 0, label: '0° (North - facing sensor from south)' },
                            { value: 45, label: '45° (Northeast)' },
                            { value: 90, label: '90° (East - facing sensor from west)' },
                            { value: 135, label: '135° (Southeast)' },
                            { value: 180, label: '180° (South - facing sensor from north)' },
                            { value: 225, label: '225° (Southwest)' },
                            { value: 270, label: '270° (West - facing sensor from east)' },
                            { value: 315, label: '315° (Northwest)' }
                        ]}
                    />
                </Form.Item>

                <Form.Item
                    label="Robot Orientation"
                    name="orientation"
                    rules={[{ required: true, message: 'Please select orientation' }]}
                    extra="Is the robot positioned for tangential (sideways) or radial (direct) approach?"
                >
                    <Select
                        style={{ width: '100%' }}
                        onChange={(value) => setOrientation(value as 'tangential' | 'radial')}
                        options={[
                            {
                                value: 'tangential',
                                label: 'Tangential (sideways - robot moves perpendicular to sensor)'
                            },
                            {
                                value: 'radial',
                                label: 'Radial (direct - robot moves toward/away from sensor)'
                            }
                        ]}
                    />
                </Form.Item>

                <Alert
                    message="Example"
                    description={
                        orientation === 'tangential'
                            ? "Tangential: Robot is 2m away at 90° (East), will move in circular path around sensor"
                            : "Radial: Robot is 2m away at 0° (North), will move directly toward/away from sensor"
                    }
                    type="success"
                    showIcon
                />
            </Form>
        </Modal>
    );
};
