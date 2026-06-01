import React, { useState, useEffect } from 'react';
import { Tab } from '@src/lib/Tab';

interface TabListProps {
    tabList: Tab[];
}

function TabList({ tabList }: TabListProps) {
    return (
        <div>
            <h2>Tab List</h2>
            <ul>
                {tabList.map((tab: Tab) => (
                    <li key={tab.id}>{tab.title}</li>
                ))}
            </ul>
        </div>
    );
};

export { TabList, TabListProps };