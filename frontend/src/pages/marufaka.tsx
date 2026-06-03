import { useState } from "react";
import { useEffect } from "react";

const TEST = () => {
    const [alarm,setAlarm] = useState(false);
    const formaterCrylic = (text: string):string => {
        if (/[а-яА-Я]/.test(text)) {
          setAlarm(true);
        } else {
          setAlarm(false);
        }
        return text.replace(/[а-яА-Я]/g, "");
      };
    
    const [inputValue, setInputValue] = useState("");
      console.log(inputValue);
      console.log(alarm);
    return (
        <div className="flex flex-col items-center justify-center h-screen">
           <h1>tilet some title</h1>
           <input className={`${alarm ? 'border-red-500' : 'border-green-500'} w-1/2 h-10 border  rounded-md p-2 text-center`} type="text" value={inputValue} onChange={(e) => {
            setInputValue(formaterCrylic(e.target.value));
           }} />
        </div>
    );
};

export default TEST;