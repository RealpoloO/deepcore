import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ProductionPlanner from '../pages/ProductionPlanner';

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

describe('ProductionPlanner', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('should render the production planner page', () => {
    renderWithRouter(<ProductionPlanner />);

    expect(screen.getByText('Production Planner')).toBeInTheDocument();
    expect(screen.getByText('Jobs Configuration')).toBeInTheDocument();
    expect(screen.getByText('Stock Existant')).toBeInTheDocument();
    expect(screen.getByText('Production Plan')).toBeInTheDocument();
  });

  it('should add a new job when form is filled and Add Job button is clicked', () => {
    renderWithRouter(<ProductionPlanner />);

    const productInput = screen.getByLabelText('Product');
    const runsInput = screen.getByLabelText('Runs');
    const meInput = screen.getByLabelText('ME');
    const teInput = screen.getByLabelText('TE');
    const addButton = screen.getByText('Add Job');

    fireEvent.change(productInput, { target: { value: 'Archon' } });
    fireEvent.change(runsInput, { target: { value: '1' } });
    fireEvent.change(meInput, { target: { value: '8' } });
    fireEvent.change(teInput, { target: { value: '16' } });
    fireEvent.click(addButton);

    expect(screen.getByText('Jobs à produire (1)')).toBeInTheDocument();
    expect(screen.getByText('Archon 1 8 16')).toBeInTheDocument();
  });

  it('should not add a job if product name is empty', () => {
    renderWithRouter(<ProductionPlanner />);

    const addButton = screen.getByText('Add Job');
    fireEvent.click(addButton);

    expect(screen.queryByText(/Jobs à produire/)).not.toBeInTheDocument();
  });

  it('should remove a job when remove button is clicked', () => {
    renderWithRouter(<ProductionPlanner />);

    const productInput = screen.getByLabelText('Product');
    const addButton = screen.getByText('Add Job');

    fireEvent.change(productInput, { target: { value: 'Archon' } });
    fireEvent.click(addButton);

    expect(screen.getByText('Archon 1 10 20')).toBeInTheDocument();

    const removeButton = screen.getByTitle('Remove job');
    fireEvent.click(removeButton);

    expect(screen.queryByText('Archon 1 10 20')).not.toBeInTheDocument();
  });

  it('should allow adding multiple jobs', () => {
    renderWithRouter(<ProductionPlanner />);

    const productInput = screen.getByLabelText('Product');
    const addButton = screen.getByText('Add Job');

    // Add first job
    fireEvent.change(productInput, { target: { value: 'Archon' } });
    fireEvent.click(addButton);

    // Add second job
    fireEvent.change(productInput, { target: { value: 'Aeon' } });
    fireEvent.click(addButton);

    expect(screen.getByText('Jobs à produire (2)')).toBeInTheDocument();
    expect(screen.getByText('Archon 1 10 20')).toBeInTheDocument();
    expect(screen.getByText('Aeon 1 10 20')).toBeInTheDocument();
  });

  it('should reset form after adding a job', () => {
    renderWithRouter(<ProductionPlanner />);

    const productInput = screen.getByLabelText('Product');
    const addButton = screen.getByText('Add Job');

    fireEvent.change(productInput, { target: { value: 'Archon' } });
    fireEvent.click(addButton);

    expect(productInput.value).toBe('');
  });

  it('should update stock textarea', () => {
    renderWithRouter(<ProductionPlanner />);

    const stockTextarea = screen.getByPlaceholderText(/Entrez votre stock existant/);
    fireEvent.change(stockTextarea, { target: { value: 'Tritanium: 1000000' } });

    expect(stockTextarea.value).toBe('Tritanium: 1000000');
  });

  it('should switch between result tabs', () => {
    renderWithRouter(<ProductionPlanner />);

    const materialsTab = screen.getByText('Stocks and Materials');
    const jobsTab = screen.getByText('Jobs to Run');

    expect(materialsTab.classList.contains('active')).toBe(true);
    expect(jobsTab.classList.contains('active')).toBe(false);

    fireEvent.click(jobsTab);

    expect(materialsTab.classList.contains('active')).toBe(false);
    expect(jobsTab.classList.contains('active')).toBe(true);
  });

  it('should disable calculate button when no jobs are added', () => {
    renderWithRouter(<ProductionPlanner />);

    const calculateButton = screen.getByText('Calculate Production Plan');
    expect(calculateButton).toBeDisabled();
  });

  it('should enable calculate button when jobs are added', () => {
    renderWithRouter(<ProductionPlanner />);

    const productInput = screen.getByLabelText('Product');
    const addButton = screen.getByText('Add Job');

    fireEvent.change(productInput, { target: { value: 'Archon' } });
    fireEvent.click(addButton);

    const calculateButton = screen.getByText('Calculate Production Plan');
    expect(calculateButton).not.toBeDisabled();
  });

  it('should accept numeric inputs for runs, ME, and TE', () => {
    renderWithRouter(<ProductionPlanner />);

    const runsInput = screen.getByLabelText('Runs');
    const meInput = screen.getByLabelText('ME');
    const teInput = screen.getByLabelText('TE');

    fireEvent.change(runsInput, { target: { value: '5' } });
    fireEvent.change(meInput, { target: { value: '9' } });
    fireEvent.change(teInput, { target: { value: '18' } });

    expect(runsInput.value).toBe('5');
    expect(meInput.value).toBe('9');
    expect(teInput.value).toBe('18');
  });

  it('should add job when Enter key is pressed in product input', () => {
    renderWithRouter(<ProductionPlanner />);

    const productInput = screen.getByLabelText('Product');

    fireEvent.change(productInput, { target: { value: 'Archon' } });
    fireEvent.keyPress(productInput, { key: 'Enter', code: 'Enter', charCode: 13 });

    expect(screen.getByText('Jobs à produire (1)')).toBeInTheDocument();
    expect(screen.getByText('Archon 1 10 20')).toBeInTheDocument();
  });
});
