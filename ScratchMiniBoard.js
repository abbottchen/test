// This is an extension for development and testing of the Scratch Javascript Extension API.

(function(ext) {
    var UART_REV_FRAME_LEN=9;
    var device = null;

    var	FrameStep=0;
    var FrameBuf= new Uint8Array(300);
    var DataLen=0;
	

    var inputs = {
        'D1': 0,
        'D2': 0,
        'D3': 0,
        'D4': 0,
        'D5': 0,
        'D6': 0,
        'A1': 0,
        'A2': 0,
        'A3': 0
    };

    inputs['D1']=2;
	
    function getSensor(which) {
        return inputs[which];
    }
    
    function getSensorFromFrame(Frame){
	    /*
	    typedef struct STRUCT_SCRATCH_CONTROL_BOARD_OUT		//
{	
	uint8	PIN7InputLevel:1;               //D6
	uint8	PIN8InputLevel:1;               //PWM2
	uint8	PIN9InputLevel:1;               //PWM1
	uint8	PIN10InputLevel:1;              //D5
	uint8	PIN11InputLevel:1;              //D4
	uint8	PIN12InputLevel:1;              //D3
	uint8	PIN17InputLevel:1;              //D1
	uint8	PIN18InputLevel:1;              //NC
	uint8	ADCPort1;
	uint8	ADCPort2;
	uint8	ADCPort3;
	uint8	ADCPort1HBit:2;
	uint8	ADCPort2HBit:2;
	uint8	ADCPort3HBit:2;
	uint8	PIN19InputLevel:1;              //NC
	uint8	PIN20InputLevel:1;              //D2
}STRUCT_SCRATCH_CONTROL_BOARD_OUT;
*/
	inputs['D1']=(Frame[2]>>6)&0x01;
	inputs['D2']=(Frame[6]>>8)&0x01;    
    	inputs['D3']=(Frame[2]>>5)&0x01;
	inputs['D4']=(Frame[2]>>4)&0x01;
	inputs['D5']=(Frame[2]>>3)&0x01;
	inputs['D6']=(Frame[2]>>0)&0x01;
	    
	inputs['A1']=Frame[3]+(Frame[6]&0x03)*256;    
	inputs['A2']=Frame[4]+((Frame[6]>>2)&0x03)*256; 
	inputs['A3']=Frame[5]+((Frame[6]>>4)&0x03)*256; 
    }
	
    function GetFrame(ch) {
	 //AA 95 4F FE FE FE BF 47 16
	 if(FrameStep>280)
		FrameStep=0; 
	//等待接收帧头    
        if(FrameStep==0){
		if(ch==0xaa){
			FrameStep=1;
			FrameBuf[0]=ch;
		}
	}
	//接收数据长度
	else if(FrameStep==1){  
	    	DataLen=ch&0x0f;
	    	FrameStep=2;
	    	FrameBuf[1]=ch;
	}
	else if((FrameStep>=2)&&(FrameStep<(2+DataLen))){
		FrameBuf[FrameStep]=ch;
		FrameStep++;
	}
	else if(FrameStep==(2+DataLen)){
		FrameBuf[FrameStep]=ch;
		
		var Sum=0;
		for(var i=0;i<(2+DataLen);i++){	
			Sum=Sum+FrameBuf[i];
		}
		Sum=Sum%256;
		console.log('Sum: ' + Sum);
		console.log('ch: ' + ch);
		if(ch!=Sum)
		{
			FrameStep=0;
			DataLen=0;
		}
		else
		{
			FrameStep++;
		}
	}
	else if(FrameStep==(3+DataLen)){ 
		FrameBuf[FrameStep]=ch;
	    	if(ch==0x16){
			clearTimeout(watchdog); 
            		watchdog = null;
			console.log('Frame is Ok');
			getSensorFromFrame(FrameBuf);
	    	}
	        else{
			FrameStep=0;
			DataLen=0;
		}	
	}
    }

    // Extension API interactions
    var potentialDevices = [];
    ext._deviceConnected = function(dev) {
        potentialDevices.push(dev);
        if (!device) {
            tryNextDevice();
        }
    }

    var watchdog = null;
    function tryNextDevice() {
        // If potentialDevices is empty, device will be undefined.
        // That will get us back here next time a device is connected.
        device = potentialDevices.shift();
        if (!device) return;

        device.open({ stopBits: 0, bitRate: 57600, parityBit:2, ctsFlowControl: 0 });
        device.set_receive_handler(function(data) {
	    var rawData = new Uint8Array(data);	
	    console.log('Received size' + data.byteLength);	
            //放置接收的数据到环形缓冲区
            for(var i=0;i<data.byteLength;i++)
            {
		console.log(rawData[i]);
		GetFrame(rawData[i]);  
            }
        });

        watchdog = setTimeout(function() {
            device.set_receive_handler(null);
            device.close();
            device = null;
            tryNextDevice();
        }, 5000);
    };
	
    ext.resetAll = function(){};	

    ext.sensor = function(which) { return getSensor(which); };	
	
    ext._deviceRemoved = function(dev) {
        if(device != dev) return;
        device = null;
    };

    ext._shutdown = function() {
        if(device) device.close();
        device = null;
    };

    ext._getStatus = function() {
        if(!device) return {status: 1, msg: 'ScratchMiniBoard disconnected'};
        if(watchdog) return {status: 1, msg: 'Probing for ScratchMiniBoard'};
        return {status: 2, msg: 'ScratchMiniBoard connected'};
    }

    var descriptor = {
        blocks: [
            [' ', '设置数字 %m.DigitalIOName 脚为 %m.DigitalIOmode', 'sensor', 'D1', '输入'],
            [' ', '输出 %m.DigitalIOOutType 电平到 数字 %m.DigitalIOName 脚', 'sensor', '低', 'D1'],
            ['r', '数字脚 %m.DigitalIOName 脚 输入电平', 'sensor', 'D1'],
            ['r', '模拟输入脚 %m.AnalogInPortName 脚 值', 'sensor', 'A1'],
            [' ', '输出 %n ms(周期),占空比 %n (0~100%) 信号到模拟输出脚 %m.AnalogIOName', 'sensor', 0,0,'PWM1']
        ],
        menus: {
            DigitalIOName:['D1','D2','D3','D4','D5','D6'],
  	    DigitalIOmode:['输入','输出'],
  	    DigitalIOOutType:['低','高'],
  	    AnalogInPortName:['A1','A2','A3'],
  	    AnalogOutPortName:['PWM1','PWM2']
        },
        url: 'https://abbottchen.github.io/test/ScratchMiniBoard.js'
    };
    ScratchExtensions.register('ScratchMiniBoard', descriptor, ext, {type: 'serial'});
})({});
