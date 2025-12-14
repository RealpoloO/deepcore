import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import IndustryConfig from '../pages/IndustryConfig';

// Mock window.alert and window.confirm
global.alert = vi.fn();
global.confirm = vi.fn();

// Mock the AuthContext
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: 1, name: 'Test User' }
  })
}));

const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('IndustryConfig', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Clear all mocks
    vi.clearAllMocks();
  });

  it('should render the industry config page', () => {
    renderWithRouter(<IndustryConfig />);

    expect(screen.getByText('Industry Configuration')).toBeInTheDocument();
    expect(screen.getByText('Production Slots')).toBeInTheDocument();
    expect(screen.getByText('Production Blacklist')).toBeInTheDocument();
  });

  it('should load default values on initial render', () => {
    renderWithRouter(<IndustryConfig />);

    const reactionSlotsInput = screen.getByLabelText(/Reaction Slots/);
    const manufacturingSlotsInput = screen.getByLabelText(/Manufacturing Slots/);
    const splitInput = screen.getByLabelText(/Don't Split Jobs Shorter Than/);

    expect(reactionSlotsInput.value).toBe('20');
    expect(manufacturingSlotsInput.value).toBe('30');
    expect(splitInput.value).toBe('1.2');
  });

  it('should update reaction slots value', () => {
    renderWithRouter(<IndustryConfig />);

    const reactionSlotsInput = screen.getByLabelText(/Reaction Slots/);
    fireEvent.change(reactionSlotsInput, { target: { value: '25' } });

    expect(reactionSlotsInput.value).toBe('25');
  });

  it('should update manufacturing slots value', () => {
    renderWithRouter(<IndustryConfig />);

    const manufacturingSlotsInput = screen.getByLabelText(/Manufacturing Slots/);
    fireEvent.change(manufacturingSlotsInput, { target: { value: '35' } });

    expect(manufacturingSlotsInput.value).toBe('35');
  });

  it('should update dont split shorter than value', () => {
    renderWithRouter(<IndustryConfig />);

    const splitInput = screen.getByLabelText(/Don't Split Jobs Shorter Than/);
    fireEvent.change(splitInput, { target: { value: '2.5' } });

    expect(splitInput.value).toBe('2.5');
  });

  it('should save config to localStorage when changed', () => {
    renderWithRouter(<IndustryConfig />);

    const reactionSlotsInput = screen.getByLabelText(/Reaction Slots/);
    fireEvent.change(reactionSlotsInput, { target: { value: '25' } });

    const savedConfig = JSON.parse(localStorage.getItem('industry_config'));
    expect(savedConfig.reactionSlots).toBe(25);
  });

  it('should have all blacklist checkboxes checked by default', () => {
    renderWithRouter(<IndustryConfig />);

    const fuelBlocksCheckbox = screen.getByLabelText('Fuel Blocks');
    const compositeCheckbox = screen.getByLabelText('Composite Reactions');
    const biochemCheckbox = screen.getByLabelText('Biochemical Reactions');
    const hybridCheckbox = screen.getByLabelText('Hybrid Reactions');
    const capitalCheckbox = screen.getByLabelText('Capital Components');
    const advancedCheckbox = screen.getByLabelText('Advanced Components');

    expect(fuelBlocksCheckbox).toBeChecked();
    expect(compositeCheckbox).toBeChecked();
    expect(biochemCheckbox).toBeChecked();
    expect(hybridCheckbox).toBeChecked();
    expect(capitalCheckbox).toBeChecked();
    expect(advancedCheckbox).toBeChecked();
  });

  it('should toggle blacklist checkboxes', () => {
    renderWithRouter(<IndustryConfig />);

    const fuelBlocksCheckbox = screen.getByLabelText('Fuel Blocks');
    expect(fuelBlocksCheckbox).toBeChecked();

    fireEvent.click(fuelBlocksCheckbox);
    expect(fuelBlocksCheckbox).not.toBeChecked();

    fireEvent.click(fuelBlocksCheckbox);
    expect(fuelBlocksCheckbox).toBeChecked();
  });

  it('should save blacklist to localStorage when changed', () => {
    renderWithRouter(<IndustryConfig />);

    const fuelBlocksCheckbox = screen.getByLabelText('Fuel Blocks');
    fireEvent.click(fuelBlocksCheckbox);

    const savedBlacklist = JSON.parse(localStorage.getItem('production_blacklist'));
    expect(savedBlacklist.fuelBlocks).toBe(false);
  });

  it('should update custom blacklist items', () => {
    renderWithRouter(<IndustryConfig />);

    const customTextarea = screen.getByPlaceholderText(/Tritanium/);
    fireEvent.change(customTextarea, { target: { value: 'Tritanium\nPyerite' } });

    expect(customTextarea.value).toBe('Tritanium\nPyerite');
  });

  it('should save custom blacklist items to localStorage', () => {
    renderWithRouter(<IndustryConfig />);

    const customTextarea = screen.getByPlaceholderText(/Tritanium/);
    fireEvent.change(customTextarea, { target: { value: 'Tritanium\nPyerite' } });

    const savedBlacklist = JSON.parse(localStorage.getItem('production_blacklist'));
    expect(savedBlacklist.customItems).toBe('Tritanium\nPyerite');
  });

  it('should show alert when Save Configuration button is clicked', () => {
    renderWithRouter(<IndustryConfig />);

    const saveButton = screen.getByText('Save Configuration');
    fireEvent.click(saveButton);

    expect(global.alert).toHaveBeenCalledWith('Configuration saved successfully!');
  });

  it('should reset to default values when Reset is confirmed', () => {
    global.confirm.mockReturnValue(true);

    renderWithRouter(<IndustryConfig />);

    // Change some values
    const reactionSlotsInput = screen.getByLabelText(/Reaction Slots/);
    fireEvent.change(reactionSlotsInput, { target: { value: '50' } });

    // Click reset
    const resetButton = screen.getByText('Reset to Default');
    fireEvent.click(resetButton);

    expect(global.confirm).toHaveBeenCalledWith('Reset all settings to default values?');
    expect(reactionSlotsInput.value).toBe('20');
  });

  it('should not reset when Reset is cancelled', () => {
    global.confirm.mockReturnValue(false);

    renderWithRouter(<IndustryConfig />);

    // Change some values
    const reactionSlotsInput = screen.getByLabelText(/Reaction Slots/);
    fireEvent.change(reactionSlotsInput, { target: { value: '50' } });

    // Click reset
    const resetButton = screen.getByText('Reset to Default');
    fireEvent.click(resetButton);

    expect(global.confirm).toHaveBeenCalledWith('Reset all settings to default values?');
    expect(reactionSlotsInput.value).toBe('50');
  });

  it('should load saved config from localStorage on mount', () => {
    // Pre-populate localStorage
    localStorage.setItem('industry_config', JSON.stringify({
      reactionSlots: 15,
      manufacturingSlots: 25,
      dontSplitShorterThan: 2.0
    }));

    renderWithRouter(<IndustryConfig />);

    const reactionSlotsInput = screen.getByLabelText(/Reaction Slots/);
    const manufacturingSlotsInput = screen.getByLabelText(/Manufacturing Slots/);
    const splitInput = screen.getByLabelText(/Don't Split Jobs Shorter Than/);

    expect(reactionSlotsInput.value).toBe('15');
    expect(manufacturingSlotsInput.value).toBe('25');
    expect(splitInput.value).toBe('2');
  });

  it('should load saved blacklist from localStorage on mount', () => {
    // Pre-populate localStorage
    localStorage.setItem('production_blacklist', JSON.stringify({
      fuelBlocks: false,
      intermediateCompositeReactions: false,
      compositeReactions: true,
      biochemicalReactions: true,
      gasPhaseReactions: true,
      hybridReactions: true,
      capitalComponents: true,
      advancedComponents: true,
      customItems: 'Tritanium'
    }));

    renderWithRouter(<IndustryConfig />);

    const fuelBlocksCheckbox = screen.getByLabelText('Fuel Blocks');
    const customTextarea = screen.getByPlaceholderText(/Tritanium/);

    expect(fuelBlocksCheckbox).not.toBeChecked();
    expect(customTextarea.value).toBe('Tritanium');
  });
});
