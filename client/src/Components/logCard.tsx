import {Card,Flex,Typography,Tag} from "antd"

const { Text } = Typography;


export function LogCard({tag,information,tagColour}: {
    tag: string;
    information: string;
    tagColour: string
})
{

    const currentDate = new Date();
    const currentHours = currentDate.getHours();
    const currentMinnute = currentDate.getMinutes();
    const currentSecconds = currentDate.getSeconds();

    const currentTIme = `${currentHours}:${currentMinnute}:${currentSecconds}`

    return(
        <Card hoverable={true}
        style={{
            backgroundColor: "rgb(250, 250, 250)"
        }}>
            <Flex gap="middle">
                <Text>{currentTIme}</Text>
                <Tag
                    color={tagColour}
                    style={{
                        borderRadius: "99px",
                    }}
                >
                    {tag}
                </Tag>
            </Flex>
            <Text>{information}</Text>
        </Card>

    )
}