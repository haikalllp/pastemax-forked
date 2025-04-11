import React from 'react';

interface ToggleSwitchProps {
  isOn: boolean;
  onToggle: () => void;
}

const ToggleSwitch = ({ isOn, onToggle }: ToggleSwitchProps) => {
  return (
    <div className="toggle-switch" onClick={onToggle}>
      <span className={`toggle-label left ${!isOn ? 'active' : ''}`}>Automatic</span>
      <div className={`toggle-switch-inner ${isOn ? 'on' : 'off'}`}></div>
      <span className={`toggle-label right ${isOn ? 'active' : ''}`}>Global</span>
    </div>
  );
};

export default ToggleSwitch;
