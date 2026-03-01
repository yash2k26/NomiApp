import { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';

interface AppModalProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  sheet?: boolean;
}

export function AppModal({ visible, onClose, children, sheet = true }: AppModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/60" onPress={onClose}>
        <Pressable
          className={sheet ? 'mt-auto bg-pet-blue-dark rounded-t-[34px] border-t border-pet-blue-light/30 px-6 pt-6 pb-8' : 'm-6 bg-pet-blue-dark rounded-[30px] border border-pet-blue-light/30 p-6'}
          onPress={(e) => e.stopPropagation()}
        >
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
