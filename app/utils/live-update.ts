import { useCallback, useState } from "react";

export const useContacts = ({initialContacts}) => {
  const [contacts, setContacts] = useState(initialContacts);

  const handleUpdate = useCallback((updatedContacts) => {
    setContacts((prevContacts) => {
      const contactMap = new Map(prevContacts.map((c) => [c.id, c]));
      updatedContacts.forEach((contact) => {
        if (contact.deleted) {
          contactMap.delete(contact.id);
        } else {
          contactMap.set(contact.id, {
            ...contactMap.get(contact.id),
            ...contact,
          });
        }
      });
      return Array.from(contactMap.values());
    });
  }, []);
  return { contacts, setContacts, handleUpdate };
};
