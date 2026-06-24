import { useTranslation } from '@/hooks/useTranslation';
import { PlanDetails } from '../utils/plan';

interface PlanActionButtonProps {
  plan: PlanDetails;
  isUserPlan: boolean;
  comingSoon?: boolean;
  upgradable?: boolean;
  onSubscribe: (priceId?: string) => void;
  onSelectPlan: (index: number) => void;
}

const PlanActionButton: React.FC<PlanActionButtonProps> = ({
  plan,
  isUserPlan,
  comingSoon,
  upgradable,
  onSubscribe,
  onSelectPlan,
}) => {
  const _ = useTranslation();

  if (isUserPlan || plan.plan === 'free') {
    return (
      <button
        disabled
        className='w-full cursor-default rounded-lg bg-green-100 px-6 py-3 font-semibold text-green-700'
      >
        {_('Current Plan')}
      </button>
    );
  }

  return (
    <button
      disabled
      className='w-full cursor-default rounded-lg bg-gray-200 px-6 py-3 font-semibold text-gray-500'
    >
      {_('Coming Soon')}
    </button>
  );
};

export default PlanActionButton;
