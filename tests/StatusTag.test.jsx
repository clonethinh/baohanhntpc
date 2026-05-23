import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusTag from '../src/components/warranty/StatusTag';
import { STATUS } from '../src/constants/statusConfig';

describe('StatusTag', () => {
  Object.entries(STATUS).forEach(([key, config]) => {
    it(`renders correct label and color for ${key}`, () => {
      render(<StatusTag status={key} />);
      expect(screen.getByText(config.label)).toBeInTheDocument();
    });
  });

  it('renders default status for unknown status', () => {
    render(<StatusTag status="unknown" />);
    expect(screen.getByText('Chờ xử lý')).toBeInTheDocument();
  });
});
